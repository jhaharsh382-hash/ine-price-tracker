const test = require('node:test');
const assert = require('node:assert');
const { PRICE_REGEX, STOCK_PATTERNS } = require('../selectors');

test('PRICE_REGEX extracts rupee prices', () => {
  const m = '₹1,299.00'.match(PRICE_REGEX);
  assert.ok(m);
  assert.strictEqual(m[1].replace(/,/g, ''), '1299.00');
});

test('PRICE_REGEX extracts plain numeric prices', () => {
  const m = 'Price: 499'.match(PRICE_REGEX);
  assert.ok(m);
  assert.strictEqual(m[1], '499');
});

test('STOCK_PATTERNS detects out of stock', () => {
  const hit = STOCK_PATTERNS.find((p) => p.re.test('Currently Out of Stock'));
  assert.strictEqual(hit.value, 'out_of_stock');
});

test('STOCK_PATTERNS detects in stock', () => {
  const hit = STOCK_PATTERNS.find((p) => p.re.test('In Stock - Add to Cart'));
  assert.strictEqual(hit.value, 'in_stock');
});
