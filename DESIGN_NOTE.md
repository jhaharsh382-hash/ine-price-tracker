

> This is a starting draft. Before you submit, replace the placeholders
> below with what you actually observed running this against the live
> mock store, and be ready to defend every decision here live — the brief
> says you may be asked to modify this code in the interview.

The brief states the store is deliberately awkward: prices change
frequently, some content loads asynchronously after a delay, and responses
are occasionally slow or error out. Fetching the raw HTML confirms this —
`https://demo.inelabteamdev.com/` returns an essentially empty shell
(a client-rendered SPA), so **any** scraper here has to deal with content
that doesn't exist until JavaScript runs.

Because the price/stock values are fetched by the page itself via
`fetch`/XHR after load, that JSON response is the source of truth the
page's own UI is built from. Reading it directly means:
- I don't need to guess when the DOM has "settled" — I read the data the
  instant it arrives, rather than polling for a CSS class to appear.
- I'm not coupled to whatever class name the frontend framework generates
  (which can change on every deploy if it's using CSS modules/hashed
  classes).
- It's naturally resistant to A/B-tested or animated UI — the numbers are
  the same regardless of how they're rendered.

DOM scraping (ranked selectors, then a regex sweep of the visible text) is
kept as a fallback for when a product page doesn't expose the data via a
JSON call I can see, or when interception misses a race.

- Navigation timeout + `waitForSelector` are both bounded, so a hung
  request degrades to a bounded failure instead of hanging the whole batch.
- A fixed short delay + selector wait absorbs the "loads after a short
  delay" behavior without just guessing a long sleep.
- Failures are retried with exponential backoff + jitter (up to 4 attempts
  by default), and every attempt — not just the final outcome — is written
  to `scrape_logs`. A product that fails all 4 attempts gets a `failed`
  log row and **no** price_history row: the app would rather show "last
  known price, 3 hours old" than a wrong number.

- **Playwright over a lightweight fetch+cheerio-only approach.** The brief
  says to prefer lightweight fetching where possible — I checked first,
  and the store's initial HTML has no product data in it at all, so a
  headless browser is required to even get past the loading shell. Cheerio
  is still used, but on the browser-rendered HTML as a fallback path, not
  as the primary fetch method.
- **Bounded concurrency (3 pages at once) over one-at-a-time.** Faster
  batches, at the cost of slightly higher memory use on Render's free
  tier — worth revisiting if the instance gets memory-constrained with
  many tracked products.
- **Cron-triggered batch over a queue system.** A queue (e.g. BullMQ +
  Redis) would handle a large number of products more gracefully, but adds
  infra the brief's free-tier constraints don't really call for at this
  scale.

_Fill this in after you actually run `npm run scrape:headed` against
`https://demo.inelabteamdev.com` a few times. Things worth recording
honestly here:_
- Which selector in `selectors.js` actually matched (or didn't), and what
  you changed once you saw the real markup.
- Any case where the "slow response" simulation needed a longer timeout
  than my default `SCRAPE_TIMEOUT_MS=20000`.
- Any JSON response shape from the store's API that `deepFindPriceStock()`
  didn't handle on the first try, and how you adjusted the key list.
- Whether the structure-hash change detection produced false positives
  (e.g. because of dynamically generated class names) and how you tuned
  `structureHash()` to ignore those.

_Be specific and honest here — this is one of the evaluation criteria, and
you'll likely be asked about it directly in the interview. Generic answers
("it forgot error handling") will be obvious. Write down the actual
mistake and the actual fix, e.g.:_
- _"The first version polled `waitForSelector` with no timeout, so a
  single hung request would hang the entire batch. I added a bounded
  `Promise.race` against a hard timeout."_
- _"The first version stored `price: 0` on failure instead of throwing,
  which would have shown up as a fake $0 price. I changed extraction to
  throw when no valid price is found, so the retry/logging path takes
  over instead of silently persisting bad data."_
