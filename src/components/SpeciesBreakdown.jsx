export default function SpeciesBreakdown({ breakdown }) {
  const total = breakdown.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="content-section">
      <div className="section-header">
        <span className="section-icon">🐄</span>
        <h3>Species Breakdown</h3>
      </div>
      <div className="species-grid">
        <div className="species-bars">
          {breakdown.map((s, i) => (
            <div className="species-bar-row" key={i}>
              <div className="species-bar-label">
                <span>{s.species}</span>
                <span className="species-bar-count">{s.count} case{s.count !== 1 ? 's' : ''}</span>
              </div>
              <div className="species-bar-track">
                <div
                  className={`species-bar-fill ${s.species.toLowerCase().includes('cattle') || s.species.toLowerCase().includes('bovine') ? 'cattle' : s.species.toLowerCase().includes('caprine') || s.species.toLowerCase().includes('goat') ? 'caprine' : s.species.toLowerCase().includes('ovine') || s.species.toLowerCase().includes('sheep') ? 'ovine' : 'canine'}`}
                  style={{ width: `${(s.count / total) * 100}%` }}
                >
                  {s.percentage}%
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="species-note">
          <strong>Why non-livestock cases matter:</strong> Canine detections signal the screwworm fly is
          established in the environment — not just transported via livestock. Dogs are typically infected
          through open wounds. Two canine cases in separate states suggest wider environmental presence
          than livestock-only cases would indicate.
        </div>
      </div>
    </div>
  );
}
