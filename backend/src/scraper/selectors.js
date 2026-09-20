






const PRICE_SELECTORS = [
  '[data-testid="product-price"]',
  '[data-test="price"]',
  '.product-price',
  '.price-value',
  '.price',
  '[class*="price"]',
];

const STOCK_SELECTORS = [
  '[data-testid="stock-status"]',
  '[data-test="stock"]',
  '.stock-status',
  '.stock',
  '[class*="stock"]',
  '[class*="availability"]',
];

const PRODUCT_CARD_SELECTORS = [
  '[data-testid="product-card"]',
  '.product-card',
  '.product-item',
  '[class*="product-card"]',
  '[class*="product-item"]',
];

const PRODUCT_NAME_SELECTORS = [
  '[data-testid="product-name"]',
  '.product-name',
  '.product-title',
  'h1',
  'h2',
  'h3',
];


const PRICE_REGEX = /(?:₹|\$|Rs\.?|INR)?\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/;


const STOCK_PATTERNS = [
  { re: /out of stock|sold out|unavailable/i, value: 'out_of_stock' },
  { re: /low stock|only \d+ left|hurry/i, value: 'low_stock' },
  { re: /in stock|available|add to cart/i, value: 'in_stock' },
];

module.exports = {
  PRICE_SELECTORS,
  STOCK_SELECTORS,
  PRODUCT_CARD_SELECTORS,
  PRODUCT_NAME_SELECTORS,
  PRICE_REGEX,
  STOCK_PATTERNS,
};
