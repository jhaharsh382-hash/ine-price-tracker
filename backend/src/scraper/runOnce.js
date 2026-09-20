



require('dotenv').config();
const logger = require('../utils/logger');
const { scrapeDueProducts } = require('../services/scrapeService');

(async () => {
  const headed = process.env.HEADLESS === 'false';
  logger.info(`Starting ${headed ? 'HEADED' : 'headless'} scrape run...`);
  try {
    const results = await scrapeDueProducts({ headed, force: true });
    results.forEach((r) => {
      if (r.ok) {
        logger.info(`✓ ${r.product}: price=${r.price} stock=${r.stock} method=${r.method}`);
      } else {
        logger.error(`✗ ${r.product}: ${r.error}`);
      }
    });
  } catch (err) {
    logger.error('Fatal error during scrape run', { error: err.message });
    process.exitCode = 1;
  }
})();
