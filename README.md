

Signal is a full-stack product monitoring dashboard for the INE mock storefront. It lets you search for products, track the ones you care about, and monitor price/stock changes over time with a resilient browser scraper, scheduled polling, and reliability logs.


- Search the live INE storefront and add products to tracking
- Track price, stock, and change history over time
- Use Playwright to fetch the page's own JSON when available, with DOM selectors as a fallback
- Retry transient failures with exponential backoff and jitter
- Record every attempt in a structured scrape log
- Detect structural page changes and flag them in the UI
- Support per-product scrape frequency and alert generation for price drops and restocks
- Built with a Node.js + Express backend and a Vite + React frontend


- Frontend: React + Vite dashboard
- Backend: Express API + scraper + scheduling endpoints
- Database: Supabase PostgreSQL
- Browser automation: Playwright
- Cron trigger: external job calling the scrape endpoint every 2 hours


```text
ine-price-tracker/
├── README.md
├── DESIGN_NOTE.md
├── .github/
│   └── workflows/
│       └── ci.yml
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── server.js
│   │   ├── db/
│   │   │   ├── schema.sql
│   │   │   ├── supabaseClient.js
│   │   │   └── repositories/
│   │   ├── routes/
│   │   ├── scraper/
│   │   ├── services/
│   │   └── utils/
│   └── node_modules/ (after install)
├── frontend/
│   ├── package.json
│   ├── .env.example
│   ├── vite.config.js
│   └── src/
└── package.json  (optional root helper scripts)
```


- Node.js 18+
- Express
- Playwright
- Supabase JS client
- React 18
- Recharts
- Vite


Before running the app:

- Node.js 18 or later installed
- npm installed
- A Supabase project created
- Access to the INE demo store in a browser if you will validate live scraping



From the project root:

```bash
npm install 
npm install 
```

If you want a single command at the root, use the helper script from the included root package after installation.


Create backend environment files from the examples:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Then fill in the values in each `.env` file.

Backend example values:

```env
PORT=0
NODE_ENV=development
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STORE_BASE_URL=https://demo.inelabteamdev.com
CRON_SECRET=change-this-to-a-long-random-string
HEADLESS=true
SCRAPE_MAX_RETRIES=4
SCRAPE_TIMEOUT_MS=20000
SCRAPE_CONCURRENCY=3
DEFAULT_SCRAPE_FREQUENCY_HOURS=2
SENDGRID_API_KEY=
ALERTS_FROM_EMAIL=alerts@yourdomain.com
```

Frontend example:

```env
VITE_API_BASE_URL=http://localhost:4000
```


1. Open your Supabase project.
2. Open the SQL editor.
3. Run the contents of `backend/src/db/schema.sql`.
4. Confirm the tables and views exist: `products`, `price_history`, `scrape_logs`, `alerts_sent`, and `product_reliability`.


```bash
cd backend
npx playwright install chromium
```



Use the root launcher to run both services. The operating system chooses a free
backend port and a free frontend port at startup, and the launcher connects the
frontend to the selected backend automatically:

```bash
npm run dev
```

Copy the `Local` frontend URL printed by Vite into your browser. The backend
health URL is the selected backend port shown in the startup log, for example:

```text
http://localhost:<backend-port>/health
```



1. Open the frontend dashboard.
2. Search for a product name in the store.
3. Click `+ Track` for the item you want.
4. The app will store the item, fire an initial scrape, and start tracking it.


On the selected product card/detail panel, click `Scrape now`.


Use the dropdown in the detail panel to set the product’s scrape cadence to 1h, 2h, 6h, 12h, or 24h.


The app is designed for cron-driven background scrapes. The production pattern is:

- External cron job calls `POST /api/scrape/run`
- Header: `x-cron-secret: <your CRON_SECRET>`
- Endpoint runs only products that are due

This avoids relying on an always-on polling loop, which is a better fit for free-tier hosting.


Run the backend unit tests:

```bash
cd backend
npm test
```

Run the frontend production build:

```bash
cd frontend
npm run build
```


A deploy-ready Render config is included in [render.yaml](./render.yaml). The app is also ready for a standard Vercel frontend deploy from the `frontend` directory.


- Build command:

```bash
npm install && npx playwright install 
```

- Start command:

```bash
npm start
```

- Set all required environment variables from `backend/.env.example`.
- Add `CORS_ORIGIN` to include your Vercel frontend domain, for example:

```env
CORS_ORIGIN=https://your-app.vercel.app
```


- Root directory: `frontend`
- Framework preset: Vite
- Set `VITE_API_BASE_URL` to the Render backend URL
- Example:

```env
VITE_API_BASE_URL=https://your-render-service.onrender.com
```


Use a service like cron-job.org and schedule:

```text
POST https://<your-render-url>/api/scrape/run
Header: x-cron-secret: <your CRON_SECRET>
```


```bash
cd backend
npm run scrape:headed
```

This opens a visible Chromium window and prints the extraction method and result. Use that run for any required demo recording or submission evidence.


The implementation prefers page-owned JSON responses from the app rather than DOM guessing, then falls back to ranked CSS selectors and regex matching. It also retries transient failures and logs each attempt to `scrape_logs` so the app can distinguish recoverable errors from broken data.

See [DESIGN_NOTE.md](./DESIGN_NOTE.md) for the full reasoning behind the scraper design and reliability decisions.


- Price drop alerts
- Back-in-stock alerts
- SendGrid email notifications when `SENDGRID_API_KEY` is configured
- Structure-change detection for page markup changes
- Reliability metrics per tracked product



This usually means the Supabase variables are missing or invalid. Check `backend/.env` and confirm the URL and service-role key are correct.


Make sure the backend is running and that your browser frontend is pointing to the correct `VITE_API_BASE_URL`.


Run:

```bash
cd backend
npx playwright install chromium
```

Then retry the scrape. For a visible run, use:

```bash
npm run scrape:headed
```
