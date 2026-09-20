


const express = require('express');
const { launchBrowser, searchProducts } = require('../scraper/scraper');
const productService = require('../services/productService');
const priceHistoryRepository = require('../db/repositories/priceHistoryRepository');
const scrapeLogRepository = require('../db/repositories/scrapeLogRepository');
const logger = require('../utils/logger');

const router = express.Router();




router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Query param "q" is required' });

  let browser;
  try {
    browser = await launchBrowser({});
    const results = await searchProducts(browser, q);
    res.json({ query: q, results });
  } catch (err) {
    logger.error('Search failed', { error: err.message });
    res.status(502).json({ error: 'Search failed', detail: err.message });
  } finally {
    if (browser) await browser.close();
  }
});


router.post('/track', async (req, res) => {
  const { name, productUrl, imageUrl, storeProductId, scrapeFrequencyHours } = req.body || {};
  if (!name || !productUrl || !storeProductId) {
    return res.status(400).json({ error: 'name, productUrl, storeProductId are required' });
  }

  try {
    const product = await productService.trackProduct({ name, productUrl, imageUrl, storeProductId, scrapeFrequencyHours });
    res.status(201).json({ product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/', async (_req, res) => {
  try {
    const products = await productService.listTrackedWithReliability();
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/:id/history', async (req, res) => {
  try {
    const history = await priceHistoryRepository.findByProduct(req.params.id);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/:id/logs', async (req, res) => {
  try {
    const logs = await scrapeLogRepository.findByProduct(req.params.id, Number(req.query.limit || 100));
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.patch('/:id', async (req, res) => {
  try {
    const product = await productService.updateProductSettings(req.params.id, req.body || {});
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
