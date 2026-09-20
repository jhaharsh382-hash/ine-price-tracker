const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  search: (q) => request(`/api/products/search?q=${encodeURIComponent(q)}`),
  listTracked: () => request('/api/products'),
  track: (payload) => request('/api/products/track', { method: 'POST', body: JSON.stringify(payload) }),
  history: (id) => request(`/api/products/${id}/history`),
  logs: (id) => request(`/api/products/${id}/logs`),
  update: (id, patch) => request(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  scrapeNow: (id) => request(`/api/scrape/run/${id}`, { method: 'POST' }),
};
