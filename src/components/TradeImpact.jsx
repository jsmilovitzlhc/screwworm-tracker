export default function TradeImpact({ impacts }) {
  return (
    <div className="content-section">
      <div className="section-header">
        <span className="section-icon">🚫</span>
        <h3>Trade &amp; Movement Restrictions</h3>
      </div>
      <div className="trade-cards">
        {impacts.map((impact, i) => {
          const d = new Date(impact.date + 'T00:00:00');
          return (
            <div className="trade-card" key={i}>
              <div className="trade-card-date">
                <div className="month">{d.toLocaleDateString('en-US', { month: 'short' })}</div>
                <div className="day">{d.getDate()}</div>
              </div>
              <div>
                <div className="trade-card-entity">{impact.entity}</div>
                <div className="trade-card-action">{impact.action}</div>
                <div className="trade-card-scope">Scope: {impact.scope}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
