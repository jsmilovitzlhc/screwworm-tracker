export default function InternationalContext({ context }) {
  return (
    <div className="content-section">
      <div className="section-header">
        <span className="section-icon">🌎</span>
        <h3>International Context</h3>
      </div>
      <div className="intl-stats">
        <div className="intl-stat">
          <div className="number">{context.totalAnimalCases.toLocaleString()}+</div>
          <div className="label">Cumulative Animal Cases (MX/CA)</div>
        </div>
        <div className="intl-stat">
          <div className="number">{context.totalHumanCases.toLocaleString()}+</div>
          <div className="label">Human Cases Reported</div>
        </div>
      </div>
      <div className="intl-countries">
        {context.affectedCountries.map((c, i) => (
          <span className="country-tag" key={i}>{c}</span>
        ))}
      </div>
      <div className="timeline">
        {context.timeline.map((event, i) => (
          <div className="timeline-item" key={i}>
            <div className="timeline-dot international" />
            <div className="timeline-date international-date">
              {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <div className="timeline-title">{event.event}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
