require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const productsRouter = require('./routes/products');
const scrapeRouter = require('./routes/scrape');
const logger = require('./utils/logger');

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.CLIENT_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 60 })); 

app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/products', productsRouter);
app.use('/api/scrape', scrapeRouter);

app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = Number(process.env.PORT || 4000);
const server = app.listen(PORT, () => {
  logger.info(`INE Price Tracker API listening on :${server.address().port}`);
});
