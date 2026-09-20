import { useState } from 'react';

export default function SearchBar({ onResults, onError, onQuery }) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  async function runSearch(e) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    onError(null);
    onQuery(q.trim());
    try {
      const { api } = await import('../api/client.js');
      const { results } = await api.search(q.trim());
      onResults(results);
    } catch (err) {
      onError(err.message);
      onResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="search-row" onSubmit={runSearch}>
      <input
        placeholder="Search the store by product name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <button className="btn" type="submit" disabled={loading}>
        {loading ? 'Searching…' : 'Search'}
      </button>
    </form>
  );
}
