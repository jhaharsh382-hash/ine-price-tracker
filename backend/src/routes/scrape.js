


const express = require('express');
const { scrapeDueProducts, scrapeOneProduct } = require('../services/scrapeService');
const productsRepository = require('../db/repositories/productsRepository');
const { launchBrowser } = require('../scraper/scraper');
const logger = require('../utils/logger');

const router = express.Router();






router.post('/run', async (req, res) => {
  const provided = req.header('x-cron-secret');
  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Invalid or missing x-cron-secret header' });
  }

  
  
  res.status(202).json({ message: 'Scrape run started' });

  try {
    const results = await scrapeDueProducts({});
    logger.info(`Cron-triggered scrape finished: ${results.filter((r) => r.ok).length}/${results.length} ok`);
  } catch (err) {
    logger.error('Cron-triggered scrape failed', { error: err.message });
  }
});


router.post('/run/:productId', async (req, res) => {
  let browser;
  try {
    const product = await productsRepository.findById(req.params.productId);
    browser = await launchBrowser({});
    const result = await scrapeOneProduct(browser, product);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

module.exports = router;
