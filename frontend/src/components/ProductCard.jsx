export default function ProductCard({ product, onSelect, isActive }) {
  const stockClass = `stock-${product.last_stock || 'unknown'}`;
  const rel = product.reliability;

  return (
    <button
      className="product-card"
      onClick={() => onSelect(product)}
      style={isActive ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' } : undefined}
    >
      <div className="name">{product.name}</div>
      <div className="price-row">
        <span className="price">
          {product.last_price != null ? `₹${Number(product.last_price).toLocaleString()}` : '—'}
        </span>
        <span className={`stock-pill ${stockClass}`}>
          {(product.last_stock || 'unknown').replace('_', ' ')}
        </span>
      </div>
      <div className="reliability-row">
        <span>every {product.scrape_frequency_hours}h</span>
        <span>{rel ? `${rel.success_rate_pct ?? 0}% reliable` : 'no data yet'}</span>
      </div>
    </button>
  );
}
