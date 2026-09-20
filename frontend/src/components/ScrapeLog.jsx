export default function ScrapeLog({ logs }) {
  if (!logs || !logs.length) {
    return <div className="empty-state">No scrape attempts logged yet.</div>;
  }

  return (
    <table className="log-table">
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>Status</th>
          <th>Attempt</th>
          <th>Duration</th>
          <th>Detail</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => (
          <tr key={log.id}>
            <td>{new Date(log.started_at).toLocaleString()}</td>
            <td>
              <span className={`status-chip status-${log.status}`}>{log.status}</span>
              {log.structure_changed && (
                <span className="status-chip status-retried" style={{ marginLeft: 6 }}>
                  structure changed
                </span>
              )}
            </td>
            <td>#{log.attempt_number}</td>
            <td>{log.duration_ms != null ? `${log.duration_ms}ms` : '—'}</td>
            <td>{log.error_message || (log.method ? `via ${log.method}` : '—')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
