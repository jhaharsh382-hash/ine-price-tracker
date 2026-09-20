export default function SearchResults({ results, query, onTrack, trackingId }) {
  if (!results || !results.length) {
    return query ? <div className="empty-state search-empty">No products found for “{query}”. Try a product name, brand, or category.</div> : null;
  }

  return (
    <div className="result-list">
      {results.map((r) => (
        <div className="result-row" key={r.storeProductId}>
          {r.imageUrl ? <img src={r.imageUrl} alt="" /> : <div style={{ width: 40, height: 40 }} />}
          <div className="name">{r.name}</div>
          <button
            className="btn-ghost"
            disabled={trackingId === r.storeProductId}
            onClick={() => onTrack(r)}
          >
            {trackingId === r.storeProductId ? 'Tracking…' : '+ Track'}
          </button>
        </div>
      ))}
    </div>
  );
}
