import { useEffect, useState, useCallback } from 'react';
import SearchBar from './components/SearchBar.jsx';
import SearchResults from './components/SearchResults.jsx';
import ProductCard from './components/ProductCard.jsx';
import ProductDetail from './components/ProductDetail.jsx';
import { api } from './api/client.js';

export default function App() {
  const [results, setResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState(null);
  const [tracked, setTracked] = useState([]);
  const [trackingId, setTrackingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const refreshTracked = useCallback(async () => {
    try {
      const { products } = await api.listTracked();
      setTracked(products);
      if (selected) {
        const updated = products.find((p) => p.id === selected.id);
        if (updated) setSelected(updated);
      }
    } catch (err) {
      setLoadError(err.message);
    }
  }, [selected]);

  useEffect(() => { refreshTracked(); }, []); 

  async function trackProduct(result) {
    setTrackingId(result.storeProductId);
    try {
      const { product } = await api.track({
        name: result.name,
        productUrl: result.productUrl,
        imageUrl: result.imageUrl,
        storeProductId: result.storeProductId,
      });
      setResults([]);
      await refreshTracked();
      setSelected(product);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setTrackingId(null);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" />
          <h1>Signal</h1>
          <span className="sub">price &amp; stock tracker for the INE store</span>
        </div>
        <div className="header-meta">
          {tracked.length} tracked · scraping every 2h by default
        </div>
      </header>

      <SearchBar onResults={setResults} onError={setSearchError} onQuery={setSearchQuery} />
      {searchError && <div className="error-banner">{searchError}</div>}
      <SearchResults results={results} query={searchQuery} onTrack={trackProduct} trackingId={trackingId} />

      <p className="section-title">Tracked products</p>
      {loadError && <div className="error-banner">{loadError}</div>}
      {tracked.length ? (
        <div className="product-grid">
          {tracked.map((p) => (
            <ProductCard key={p.id} product={p} onSelect={setSelected} isActive={selected?.id === p.id} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          Nothing tracked yet — search above and hit "+ Track" on a product to start.
        </div>
      )}

      {selected && <ProductDetail product={selected} onUpdated={refreshTracked} />}
    </div>
  );
}
