const logger = require('../utils/logger');


async function withRetry(fn, {
  maxRetries = 4,
  baseDelayMs = 800,
  maxDelayMs = 10000,
  onAttempt = () => {},
} = {}) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const start = Date.now();
    try {
      const result = await fn(attempt);
      onAttempt(attempt, null, Date.now() - start);
      return result;
    } catch (err) {
      lastError = err;
      const durationMs = Date.now() - start;
      const isLastAttempt = attempt === maxRetries;
      onAttempt(attempt, err, durationMs, isLastAttempt);

      if (isLastAttempt) break;

      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.random() * backoff * 0.3;
      const delay = backoff + jitter;

      logger.warn(`Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms`, {
        error: err.message,
      });
      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { withRetry, sleep };
