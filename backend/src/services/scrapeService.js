


const logger = require('../utils/logger');
const { withRetry } = require('../scraper/retry');
const { launchBrowser, scrapeProduct } = require('../scraper/scraper');
const productsRepository = require('../db/repositories/productsRepository');
const priceHistoryRepository = require('../db/repositories/priceHistoryRepository');
const scrapeLogRepository = require('../db/repositories/scrapeLogRepository');
const { checkAndSendAlerts } = require('./alertService');

const MAX_RETRIES = Number(process.env.SCRAPE_MAX_RETRIES || 4);




async function scrapeOneProduct(browser, product) {
  let result;

  try {
    result = await withRetry((attempt) => scrapeProduct(browser, product), {
      maxRetries: MAX_RETRIES,
      onAttempt: (attemptNumber, err, durationMs, isLastAttempt) =>
        scrapeLogRepository.recordAttempt(product.id, {
          status: err ? (isLastAttempt ? 'failed' : 'retried') : 'success',
          attemptNumber,
          durationMs,
          errorMessage: err ? err.message : null,
        }),
    });
  } catch (err) {
    logger.error(`Giving up on "${product.name}" after ${MAX_RETRIES} attempts`, { error: err.message });
    return { ok: false, error: err.message };
  }

  const { price, stock, method, structureHash } = result;
  const structureChanged = Boolean(product.dom_structure_hash && product.dom_structure_hash !== structureHash);

  if (structureChanged) {
    logger.warn(`Store markup structure changed for "${product.name}"`, { productId: product.id });
  }
  await scrapeLogRepository.annotateLatestSuccess(product.id, { method, structureChanged });

  await priceHistoryRepository.recordPoint(product.id, { price, stock });
  await productsRepository.recordSuccessfulScrape(product.id, { price, stock, structureHash });
  await checkAndSendAlerts(product, { price, stock });

  return { ok: true, price, stock, method, structureChanged };
}



async function scrapeDueProducts({ headed = false, force = false } = {}) {
  const products = await productsRepository.findAllActive();
  const due = force ? products : products.filter(isDue);

  if (!due.length) {
    logger.info('No products due for scraping.');
    return [];
  }

  const browser = await launchBrowser({ headed });
  const concurrency = Number(process.env.SCRAPE_CONCURRENCY || 3);
  const results = [];

  try {
    for (let i = 0; i < due.length; i += concurrency) {
      const batch = due.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((product) => scrapeOneProduct(browser, product).then((r) => ({ product: product.name, ...r })))
      );
      results.push(...batchResults);
    }
  } finally {
    await browser.close();
  }

  logger.info(`Scrape batch complete: ${results.filter((r) => r.ok).length}/${results.length} succeeded`);
  return results;
}

function isDue(product) {
  if (!product.last_scraped_at) return true;
  const nextDueAt = new Date(product.last_scraped_at).getTime() + product.scrape_frequency_hours * 3600 * 1000;
  return Date.now() >= nextDueAt;
}

module.exports = { scrapeOneProduct, scrapeDueProducts };
