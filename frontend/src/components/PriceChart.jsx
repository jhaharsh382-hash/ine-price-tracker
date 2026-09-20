import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function PriceChart({ history }) {
  if (!history || !history.length) {
    return <div className="empty-state">No price history yet — the first scrape will populate this chart.</div>;
  }

  const data = history.map((h) => ({
    time: new Date(h.scraped_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    price: Number(h.price),
    stock: h.stock_status,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#262b35" />
        <XAxis dataKey="time" stroke="#626b7a" fontSize={11} tick={{ fontFamily: 'JetBrains Mono' }} />
        <YAxis stroke="#626b7a" fontSize={11} tick={{ fontFamily: 'JetBrains Mono' }} domain={['auto', 'auto']} />
        <Tooltip
          contentStyle={{ background: '#14171d', border: '1px solid #2a2f3a', fontFamily: 'JetBrains Mono', fontSize: 12 }}
          labelStyle={{ color: '#9aa3b2' }}
        />
        <Line type="monotone" dataKey="price" stroke="#4fd1c5" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
