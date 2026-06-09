export default function StateResponse({ responses }) {
  return (
    <div className="content-section">
      <div className="section-header">
        <span className="section-icon">🏛️</span>
        <h3>State &amp; Federal Response</h3>
      </div>
      <div className="response-grid">
        {responses.map((r, i) => (
          <div className="response-card" key={i}>
            <h4>{r.state}</h4>
            <ul>
              {r.actions.map((action, j) => (
                <li key={j}>{action}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
