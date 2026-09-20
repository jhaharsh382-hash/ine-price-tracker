const { chromium } = require('playwright');
const cheerio = require('cheerio');
const crypto = require('crypto');
const logger = require('../utils/logger');
const {
  PRICE_SELECTORS,
  STOCK_SELECTORS,
  PRODUCT_CARD_SELECTORS,
  PRODUCT_NAME_SELECTORS,
  PRICE_REGEX,
  STOCK_PATTERNS,
} = require('./selectors');

const STORE_BASE_URL = process.env.STORE_BASE_URL || 'https://demo.inelabteamdev.com';
const NAV_TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS || 20000);
const HEADLESS = process.env.HEADLESS !== 'false';

async function launchBrowser({ headed = false } = {}) {
  return chromium.launch({
    headless: headed ? false : HEADLESS,
    args: ['--disable-blink-features=AutomationControlled'],
  });
}







function attachNetworkCapture(page) {
  const captured = [];

  page.on('response', async (response) => {
    try {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      if (!contentType.includes('application/json')) return;
      if (response.status() >= 400) return;

      const body = await response.json().catch(() => null);
      if (body) captured.push({ url, body });
    } catch {
      
    }
  });

  return captured;
}


function extractFromJson(body) {
  const candidates = Array.isArray(body) ? body : [body];
  for (const obj of candidates) {
    const found = deepFindPriceStock(obj);
    if (found) return found;
  }
  return null;
}

function deepFindPriceStock(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 4) return null;

  const priceKeys = ['price', 'currentPrice', 'salePrice', 'amount'];
  const stockKeys = ['stock', 'stockStatus', 'availability', 'inStock', 'quantity'];

  let price, stockRaw;

  for (const k of priceKeys) {
    if (obj[k] !== undefined && (typeof obj[k] === 'number' || typeof obj[k] === 'string')) {
      const n = Number(String(obj[k]).replace(/[^0-9.]/g, ''));
      if (!Number.isNaN(n) && n > 0) { price = n; break; }
    }
  }
  for (const k of stockKeys) {
    if (obj[k] !== undefined) { stockRaw = obj[k]; break; }
  }

  if (price !== undefined) {
    return { price, stock: normaliseStock(stockRaw) };
  }

  
  for (const key of Object.keys(obj)) {
    const child = obj[key];
    if (child && typeof child === 'object') {
      const result = deepFindPriceStock(child, depth + 1);
      if (result) return result;
    }
  }
  return null;
}

function normaliseStock(raw) {
  if (raw === undefined || raw === null) return 'unknown';
  if (typeof raw === 'boolean') return raw ? 'in_stock' : 'out_of_stock';
  if (typeof raw === 'number') return raw > 0 ? 'in_stock' : 'out_of_stock';
  const s = String(raw).toLowerCase();
  for (const { re, value } of STOCK_PATTERNS) {
    if (re.test(s)) return value;
  }
  return s.includes('out') ? 'out_of_stock' : s.includes('in') ? 'in_stock' : 'unknown';
}



function extractFromDom(html) {
  const $ = cheerio.load(html);

  let price = firstMatch($, PRICE_SELECTORS, (text) => {
    const m = text.match(PRICE_REGEX);
    if (!m) return null;
    const n = Number(m[1].replace(/,/g, ''));
    return Number.isNaN(n) ? null : n;
  });

  let stock = firstMatch($, STOCK_SELECTORS, (text) => normaliseStockText(text));

  
  if (price === null) {
    const bodyText = $('body').text();
    const m = bodyText.match(PRICE_REGEX);
    if (m) price = Number(m[1].replace(/,/g, ''));
  }
  if (!stock) {
    const bodyText = $('body').text();
    stock = normaliseStockText(bodyText) || 'unknown';
  }

  return { price: price ?? null, stock };
}

function firstMatch($, selectors, transform) {
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      const val = transform(el.text().trim());
      if (val !== null && val !== undefined) return val;
    }
  }
  return null;
}

function normaliseStockText(text) {
  for (const { re, value } of STOCK_PATTERNS) {
    if (re.test(text)) return value;
  }
  return null;
}



function structureHash(html) {
  const $ = cheerio.load(html);
  const skeleton = [];
  $('body *').each((_, el) => {
    if (skeleton.length > 500) return; 
    const tag = el.tagName;
    const cls = ($(el).attr('class') || '').split(/\s+/).slice(0, 2).join('.');
    skeleton.push(`${tag}.${cls}`);
  });
  return crypto.createHash('sha1').update(skeleton.join('|')).digest('hex');
}


async function searchProducts(browser, query) {
  const page = await browser.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT_MS);
  try {
    const url = `${STORE_BASE_URL}/?search=${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });

    
    
    
    const catalog = await page.evaluate(async () => {
      const firstPage = await fetch('/api/catalog?page=1&pageSize=60');
      if (!firstPage.ok) throw new Error(`catalog ${firstPage.status}`);
      const first = await firstPage.json();
      const pages = Number(first.pages || 1);
      const remaining = await Promise.all(
        Array.from({ length: Math.max(0, pages - 1) }, (_, index) =>
          fetch(`/api/catalog?page=${index + 2}&pageSize=60`).then((response) => {
            if (!response.ok) throw new Error(`catalog ${response.status}`);
            return response.json();
          })
        )
      );
      return [first, ...remaining].flatMap((response) => response.items || []);
    }).catch(() => null);

    if (catalog) {
      const normalizedQuery = query.toLowerCase().trim();
      const matches = catalog
        .filter((item) => {
          const searchableText = [item.name, item.category, item.brand, item.description, item.sku]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return searchableText.includes(normalizedQuery);
        })
        .map((item) => ({
          name: item.name,
          productUrl: `${STORE_BASE_URL}/product/${item.slug}`,
          imageUrl: null,
          storeProductId: String(item.id),
        }));

      return [...new Map(matches.map((item) => [item.storeProductId, item])).values()];
    }

    
    
    await Promise.race([
      page.waitForSelector(PRODUCT_CARD_SELECTORS.join(','), { timeout: NAV_TIMEOUT_MS }).catch(() => null),
      page.waitForTimeout(NAV_TIMEOUT_MS),
    ]);

    const html = await page.content();
    const $ = cheerio.load(html);

    const results = [];
    for (const sel of PRODUCT_CARD_SELECTORS) {
      $(sel).each((_, el) => {
        const card = $(el);
        const name = firstNonEmpty(PRODUCT_NAME_SELECTORS.map((s) => card.find(s).first().text().trim()));
        const link = card.find('a').first().attr('href');
        const img = card.find('img').first().attr('src');
        if (name && link) {
          results.push({
            name,
            productUrl: absoluteUrl(link),
            imageUrl: img ? absoluteUrl(img) : null,
            storeProductId: slugFromUrl(link),
          });
        }
      });
      if (results.length) break; 
    }

    
    const filtered = query
      ? results.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
      : results;

    return filtered.length ? filtered : results;
  } finally {
    await page.close();
  }
}



async function scrapeProduct(browser, product) {
  const page = await browser.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT_MS);
  const captured = attachNetworkCapture(page);

  try {
    const response = await page.goto(product.product_url, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT_MS,
    });

    if (!response || response.status() >= 500) {
      throw new Error(`Store returned HTTP ${response ? response.status() : 'no response'}`);
    }

    
    
    await page.waitForTimeout(1500);
    await Promise.race([
      page.waitForSelector(PRICE_SELECTORS.join(','), { timeout: NAV_TIMEOUT_MS }).catch(() => null),
      page.waitForTimeout(NAV_TIMEOUT_MS),
    ]);

    
    let extracted = null;
    let method = 'network_intercept';
    for (const { body } of captured) {
      extracted = extractFromJson(body);
      if (extracted && extracted.price) break;
    }

    
    const html = await page.content();
    if (!extracted || !extracted.price) {
      method = 'dom_fallback';
      extracted = extractFromDom(html);
    }

    if (!extracted || !extracted.price || extracted.price <= 0) {
      throw new Error('Could not extract a valid price from network responses or DOM');
    }

    return {
      price: extracted.price,
      stock: extracted.stock || 'unknown',
      method,
      structureHash: structureHash(html),
    };
  } finally {
    await page.close();
  }
}

function firstNonEmpty(arr) {
  return arr.find((s) => s && s.length) || '';
}

function absoluteUrl(href) {
  try {
    return new URL(href, STORE_BASE_URL).toString();
  } catch {
    return href;
  }
}

function slugFromUrl(href) {
  const parts = href.split('/').filter(Boolean);
  return parts[parts.length - 1] || href;
}

module.exports = {
  launchBrowser,
  searchProducts,
  scrapeProduct,
};
