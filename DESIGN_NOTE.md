

# Design Note: INE Price Tracker

## 1. Product goal

The product is a monitoring dashboard for a mock storefront where prices and stock can shift frequently and where the underlying storefront is intentionally awkward to scrape. The app needs to let a user:

- search the live INE catalog,
- track products by URL or product ID,
- monitor recent price and stock changes,
- receive alerts for price drops and restocks,
- see whether a product is failing or has changed structurally,
- run a scheduled background scrape without requiring an always-on polling loop.

This is not a simple static HTML scraper. The store behaves like a client-rendered application: the initial page shell loads but the real product data arrives later through browser-side fetches and runtime rendering. The scraper therefore has to be resilient to network delay, asynchronous page hydration, and occasional API errors.

---

## 2. Observed storefront behavior

The live app at https://demo.inelabteamdev.com is effectively a JavaScript-heavy SPA. The initial HTML is not a product catalog or product detail page with final values already embedded. Instead, the app renders a shell and then fills the page through client-side calls.

From this, the key design constraint is clear:

- DOM scraping alone is not reliable enough as the primary extraction method.
- The page's own runtime JSON/XML/fetch responses are the source of truth for price and stock values.
- The scraper must therefore wait for client-side data to load, capture the outgoing API payloads, and only fall back to DOM parsing when the payload path fails.

This is the central design decision behind the scraper. We do not poll the DOM until a CSS class appears; we capture the page-owned data the instant it is requested.

---

## 3. System architecture

The application is split into a Node.js + Express backend and a React + Vite frontend.

### Backend

- Express API exposes endpoints for product search, tracking, manual scrapes, and cron-triggered jobs.
- The scraper layer uses Playwright to load product pages in a real browser context.
- The database layer is Supabase PostgreSQL, with tables for products, price history, scrape attempts, and alert records.
- The service layer coordinates retries, structure checks, alert generation, and persistence.

### Frontend

- React dashboard shows tracked products, recent price charts, search results, and product detail panels.
- Product cards include metadata such as last known price, stock status, scrape cadence, and reliability metrics.
- The UI reads the backend APIs rather than scraping the storefront directly.

### Scheduling

The app is designed around cron-driven scraping instead of a forever-running poll loop.

- A cron or external job calls the backend scrape endpoint on a schedule.
- The backend only scrapes products whose `last_scraped_at` and `scrape_frequency_hours` indicate they are due.
- This keeps the app better suited to free-tier hosting and avoids needless background work.

---

## 4. Scraper strategy

### 4.1 Why Playwright

A fetch + cheerio solution alone would not be enough for this store because the initial HTML is effectively empty. Playwright is required to execute the page JavaScript and to observe the network calls the storefront makes after render.

We use Playwright as the primary tool, not as a last resort. Cheerio is still used as a fallback, but only after browser execution and page content capture.

### 4.2 Network-first extraction

The scraper attaches a response listener to the page and captures JSON responses from the store. It filters for application/json payloads and tries to extract a valid price and stock value from the response body.

The extraction routine is recursive and tolerant to nested payloads. It walks object graphs and looks for common keys such as:

- price: `price`, `currentPrice`, `salePrice`, `amount`
- stock: `stock`, `stockStatus`, `availability`, `inStock`, `quantity`

This is important because storefront APIs do not all serialize the same property names. The first version only looked for a narrow set of keys; the real payloads in the live app required broader matching, especially when values were nested inside objects and arrays.

The implementation does not trust a JSON field as valid unless it resolves to a positive numeric price. If the extracted price is invalid, zero, or missing, it falls back to the DOM path instead of writing false data.

### 4.3 DOM fallback

If the JSON path fails, the scraper extracts from the rendered HTML using ranked selectors and regex parsing.

The implementation tries selectors in priority order:

- product price selectors: `data-testid`, `data-test`, and CSS classes like `.price`, `.price-value`, etc.
- stock selectors: `stock-status`, `availability`, and class names containing `stock` or `availability`
- product card selectors for catalog search

This fallback is intentionally conservative. The DOM match is used only when network capture cannot provide a valid answer. It avoids depending on a single fragile selector and instead tries multiple known patterns before extracting a final value.

### 4.4 Timing and reliability

The live store occasionally responds slowly or loads content after a short delay. The scraper therefore uses defensive timing logic instead of a naive fixed sleep.

- navigation timeout is bounded,
- page waits are capped to a controlled timeout,
- selector waits are wrapped in `Promise.race(...)` so a hung request cannot stall the whole batch,
- a short wait is used to allow asynchronous rendering without waiting arbitrarily long.

This was an explicit fix to the earlier failure mode where a single long-running page could block an entire scheduling run. The hard timeout prevents the job from hanging indefinitely and allows the retry layer to take over cleanly.

---

## 5. Retry and logging model

Every product scrape goes through an exponential backoff retry loop.

- max retries default to 4 attempts
- delay starts low and increases exponentially
- jitter is added to reduce synchronized retry storms
- each attempt is recorded in `scrape_logs`

The retry design was built around the idea that transient failures are normal on a storefront with slow responses or occasional API issues. We do not silently replace the bad result with a fake zero or stale number.

A failed final attempt records a `failed` status and does not persist a price_history point. This is a deliberate correctness decision:

- the system prefers to show the last known valid price as stale rather than incorrectly insert a wrong value,
- it keeps the data integrity boundary clear,
- it enables the product reliability metrics to show real failure rates.

The app also logs the method used on the last successful attempt:

- `network_intercept` when the store JSON response was successfully read,
- `dom_fallback` when the page HTML had to be parsed as backup.

---

## 6. Structure-change detection

The app stores a structural hash of each product page to detect markup drift.

The hash is built from a simplified page skeleton rather than the full HTML. It intentionally reduces each node down to tag + a small class fingerprint so that volatile framework-generated class names or CSS module hashes do not trigger false positives. This is important because dynamic class names are common in modern frontends and would otherwise create noisy “structure changed” alerts.

During a successful scrape, the system compares the fresh structure hash to the product's last stored `dom_structure_hash`:

- if it changes, the product is flagged as having a structural page change,
- this is surfaced to the operator and does not automatically invalidate the price data,
- it acts as a maintenance signal for the scraper to inspect whether a selector or extraction path needs updating.

This design keeps the app resilient to UI refactors without treating every harmless class-name churn as a real product change.

---

## 7. Alerting and business logic

The app supports a simple alert engine for the most valuable use cases:

- price_drop: triggered when the latest price is lower than the previous stored price
- back_in_stock: triggered when the latest stock status changes from unavailable to available

Alerts are persisted in `alerts_sent` and can also be emitted via email when a SendGrid key is configured.

The key rule is that alerts are only generated when the scrape succeeds and the new value is actually different from the previous known state. This avoids a flood of duplicate notifications from retries or repeated identical values.

---

## 8. Data model

The database is intentionally compact and solves the core requirements without introducing a heavy queueing system.

### `products`

Tracks the canonical product record:

- `store_product_id`
- `product_url`
- `name`
- `image_url`
- `category`
- `last_price`
- `last_stock`
- `last_scraped_at`
- `scrape_frequency_hours`
- `is_active`
- `dom_structure_hash`

### `price_history`

Stores a chronological time series of price points and stock status for each product. This supports charting and historical trend analysis.

### `scrape_logs`

Records each attempted scrape run, including:

- status: `success`, `retried`, or `failed`
- attempt number
- duration in milliseconds
- method used
- error message on failure
- structure change flag

This is essential because operational debugging depends on knowing whether a product failed on the first attempt, the final attempt, or the extraction path itself.

### `alerts_sent`

Stores the alert events generated for each product so that duplicate alerts are avoided and notifications remain auditable.

### `product_reliability`

A view that aggregates successful and failed attempts to compute a reliability score. This is used in the dashboard to distinguish healthy products from those with repeated failures.

---

## 9. Operational decisions and trade-offs

### Why not a queue system?

A queue like BullMQ + Redis would make large-volume product tracking easier, but it is more infrastructure than this project needs. The current design is intentionally simpler and better aligned with free-tier hosting and a smaller tracked catalog.

### Why not a one-at-a-time scraper?

Bounded concurrency is used to improve throughput. Scraping products in a small concurrent batch reduces wall-clock processing time while still keeping memory usage under control. A concurrency of three is a reasonable balance for a free-tier deployment.

### Why not rely only on visible DOM text?

The target site is not a static HTML catalog; it drives product state from runtime data. Reading the page JSON is more accurate and more robust than guessing based on visible text or hashed class names.

---

## 10. What actually changed during implementation

The main implementation issues were not theoretical; they were discovered in the real scraping flow.

### Issue 1: Initial page HTML was empty

The first approach assumed that loading the storefront would immediately yield product data in the raw HTML. It did not. The actual page shell was empty and the live values arrived through client-side requests. That is why the scraper moved to network capture and browser execution as the primary path.

### Issue 2: The selector strategy needed fallback coverage

A narrow set of selectors did not match the real storefront markup reliably. The selector list was expanded to include test IDs, class-based patterns, and general price/stock markers to cover both the live storefront and minor DOM variation.

### Issue 3: Hardened timeouts were required

Without a bounded timeout path, one slow page could stall the whole batch. The final implementation uses `Promise.race` and a hard timeout so the scraper fails fast and moves to the retry layer.

### Issue 4: Silent `price = 0` failures had to be rejected

A naive extractor can produce a false zero or a null-like value that looks valid enough to persist. The final logic throws when a valid positive price cannot be extracted, ensuring the retry and logging path handles the failure properly instead of creating incorrect history records.

### Issue 5: Structure hash had to ignore dynamic UI noise

Class names can change frequently, which produces false positives in structure detection. The hash intentionally reduces markup to a smaller skeleton and ignores noisy class churn rather than comparing an entire rendered DOM tree one-to-one.

---

## 11. Current implementation summary

The project is built around four core principles:

1. use a real browser when the storefront is client-rendered,
2. prefer page-owned JSON responses over DOM heuristics,
3. fail safely and retry transient issues instead of persisting bad data,
4. keep every scrape attempt auditable through logs and reliability metrics.

This architecture gives the app enough robustness for a fragile mock storefront while staying simple enough for a lightweight production deployment.

---

## 12. Runbook and verification

To validate the app locally:

```bash
cd backend
npm install
npx playwright install chromium
npm test
```

Then run the app:

```bash
npm run dev
```

And validate the scraper manually:

```bash
cd backend
npm run scrape:headed
```

The manual headed run is useful for confirming that the real page is returning data through network calls, that the extraction method is selecting the right payload, and that the scraper behaves correctly under slow or failing storefront conditions.

---

## 13. What AI tools got wrong at first, and how I corrected it

The AI-assisted workflow was useful for generating structure quickly, but it also made a few bad assumptions early on because it was reasoning from a generic e-commerce pattern instead of the real INE storefront behavior.

### 13.1 Wrong assumption: “The page HTML will contain the product data directly”

The first draft of the scraper logic assumed that the initial document loaded by the browser would include the final price and stock values. That was wrong. The live storefront is a client-rendered application and the real data appears only after JavaScript runs and the app makes its own fetch calls.

I corrected this by verifying the actual network behavior in Playwright, listening for JSON responses, and treating the page-owned API response as the source of truth instead of trusting the raw HTML shell. This decision became the foundation of the scraper design.

### 13.2 Wrong assumption: “A simple DOM selector is enough”

The generated approach initially leaned on a narrow set of selectors such as a single `.price` or `.stock` class. That failed because real storefront markup is unstable, class names vary, and product data can be rendered in different ways depending on screen state and app updates.

I corrected this by widening the selector strategy, ranking multiple selectors, and keeping a regex-based DOM fallback as a backup rather than as the main path. The key lesson was not to trust one brittle selector in a dynamic UI.

### 13.3 Wrong assumption: “If extraction fails, return 0 or null and keep going”

One of the common bad AI patterns is to keep the code running by substituting a default value such as `0` or `unknown` instead of failing properly. That is dangerous in a price tracker because it creates false data in the database.

I corrected this by making extraction fail explicitly when the price cannot be validated. That forced the retry loop and scrape logging to handle the issue correctly and prevented fake price entries from being recorded as real values.

### 13.4 Wrong assumption: “A long timeout is harmless”

The AI-generated version of the logic often suggested waiting for a selector with no proper bound, which would let a slow page stall the batch. That is exactly the kind of hidden failure that makes a scraper appear reliable in tests but fail in production.

I corrected this by adding bounded waits and `Promise.race(...)` logic around navigation and selector waits so a hung page fails fast and falls into the retry path instead of blocking the whole run.

### 13.5 Wrong assumption: “A queue or heavy infrastructure is necessary for this project”

The AI suggestions sometimes favored larger architectures such as message queues or more elaborate orchestration because those are common patterns in production systems. They are not necessary for a small free-tier app with a limited product set.

I corrected this by keeping the design focused: bounded concurrency, cron-based execution, and a simple database-backed model. This reduced complexity without sacrificing correctness.

### 13.6 What I learned from correcting it

The most important lesson was that AI is good at producing a believable first pass, but it is not reliable at deciding real-world edge cases without evidence. I corrected the design by checking the actual behavior of the storefront, observing the network traffic, and validating each assumption against what the browser and the logs were really doing.

In other words, the AI helped with speed and structure, but the final correctness came from being skeptical, testing in the live environment, and forcing the code to fail safely when the assumptions were wrong.

---

## 14. Final design judgment

This scraper design is intentionally pragmatic. It does not attempt to mimic a generic crawler. Instead, it treats the storefront as a dynamic application with real API-driven state, captures the relevant data in the browser context, and handles failure modes explicitly.

That is the right fit for this kind of project: the product is not just about scraping data once, but about building a dependable monitoring system that can handle time-varying prices, page churn, and imperfect external services without poisoning the database with false information.
