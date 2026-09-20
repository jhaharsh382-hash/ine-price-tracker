import { useEffect, useState, useCallback } from 'react';
import PriceChart from './PriceChart.jsx';
import ScrapeLog from './ScrapeLog.jsx';
import { api } from '../api/client.js';

export default function ProductDetail({ product, onUpdated }) {
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [h, l] = await Promise.all([api.history(product.id), api.logs(product.id)]);
      setHistory(h.history);
      setLogs(l.logs);
    } catch (err) {
      setError(err.message);
    }
  }, [product.id]);

  useEffect(() => { load(); }, [load]);

  async function scrapeNow() {
    setScraping(true);
    setError(null);
    try {
      await api.scrapeNow(product.id);
      await load();
      onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setScraping(false);
    }
  }

  async function changeFrequency(e) {
    const hours = Number(e.target.value);
    await api.update(product.id, { scrapeFrequencyHours: hours });
    onUpdated();
  }

  const lastChanged = logs.find((l) => l.structure_changed);

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div>
          <h2>{product.name}</h2>
          <a href={product.product_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            view on store ↗
          </a>
          {lastChanged && (
            <div className="structure-flag">⚠ store markup changed since tracking began — scraper adapted automatically</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select className="freq-select" value={product.scrape_frequency_hours} onChange={changeFrequency}>
            <option value={1}>every 1h</option>
            <option value={2}>every 2h</option>
            <option value={6}>every 6h</option>
            <option value={12}>every 12h</option>
            <option value={24}>every 24h</option>
          </select>
          <button className="btn-ghost" onClick={scrapeNow} disabled={scraping}>
            {scraping ? 'Scraping…' : 'Scrape now'}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <p className="section-title">Price &amp; stock history</p>
      <PriceChart history={history} />

      <p className="section-title" style={{ marginTop: 28 }}>Scrape log</p>
      <ScrapeLog logs={logs} />
    </div>
  );
}
