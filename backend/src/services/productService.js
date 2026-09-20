



const logger = require('../utils/logger');
const productsRepository = require('../db/repositories/productsRepository');
const { launchBrowser } = require('../scraper/scraper');
const { scrapeOneProduct } = require('./scrapeService');

const DEFAULT_FREQUENCY_HOURS = Number(process.env.DEFAULT_SCRAPE_FREQUENCY_HOURS || 2);

async function trackProduct({ name, productUrl, imageUrl, storeProductId, scrapeFrequencyHours }) {
  const product = await productsRepository.upsertTracked({
    name,
    productUrl,
    imageUrl,
    storeProductId,
    scrapeFrequencyHours: scrapeFrequencyHours || DEFAULT_FREQUENCY_HOURS,
  });

  
  
  runInitialScrape(product);

  return product;
}

async function runInitialScrape(product) {
  const browser = await launchBrowser({});
  try {
    await scrapeOneProduct(browser, product);
  } catch (err) {
    logger.error(`Initial scrape failed for "${product.name}"`, { error: err.message });
  } finally {
    await browser.close();
  }
}

async function listTrackedWithReliability() {
  const [products, reliabilityByProductId] = await Promise.all([
    productsRepository.findAll(),
    productsRepository.findReliabilityByProductId(),
  ]);
  return products.map((p) => ({ ...p, reliability: reliabilityByProductId[p.id] || null }));
}

async function updateProductSettings(id, { scrapeFrequencyHours, isActive }) {
  const patch = {};
  if (scrapeFrequencyHours) patch.scrape_frequency_hours = scrapeFrequencyHours;
  if (typeof isActive === 'boolean') patch.is_active = isActive;
  return productsRepository.updatePatch(id, patch);
}

module.exports = { trackProduct, listTrackedWithReliability, updateProductSettings };
