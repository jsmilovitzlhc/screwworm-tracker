import { useMemo } from 'react';
import data from '../data/cases.json';
import BareMap from '../components/BareMap';
import useArticles, { formatDate, formatShortDate, stripHtml } from '../hooks/useArticles';

export default function DenseLayout() {
  const isEmbed = new URLSearchParams(window.location.search).get('embed') === 'true';
  const { articles, loading, error } = useArticles();

  const activeCases = useMemo(() => data.confirmedCases.filter(c => c.status === 'active'), []);
  const states = useMemo(() => [...new Set(data.confirmedCases.map(c => c.state))], []);
  const species = useMemo(() => [...new Set(data.confirmedCases.map(c => c.species))], []);

  const lastUpdated = new Date(data.lastUpdated).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const allEvents = [
    ...data.internationalContext.timeline.map(e => ({
      date: e.date, title: e.event, type: 'international',
    })),
    ...data.confirmedCases.map(c => ({
      date: c.date,
      title: `${c.species} (${c.animal}) — ${c.county} Co., ${c.state}`,
      detail: c.notes,
      type: 'us-case',
      status: c.status,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className={`dense-layout ${isEmbed ? 'embed-mode' : ''}`}>
      {!isEmbed && (
        <header className="site-header">
          <div className="header-brand">
            <div>
              <h1>Screwworm Outbreak Tracker</h1>
              <div className="mp-tag">Meatingplace Data</div>
            </div>
          </div>
          <div className="alert-badge">
            <div className="alert-dot" />
            Active Outbreak
          </div>
        </header>
      )}

      {/* Top section: Map (60%) + Stats & Articles (40%) */}
      <div className="dense-top">
        <div className="dense-map-col">
          <BareMap
            cases={data.confirmedCases}
            quarantineZones={data.quarantineZones}
            height="100%"
            showSlider={true}
            showLegend={true}
          />
        </div>
        <div className="dense-sidebar">
          <div className="dense-stats">
            <div className="dense-stat danger">
              <div className="dense-stat-num">{data.confirmedCases.length}</div>
              <div className="dense-stat-label">Total Cases</div>
            </div>
            <div className="dense-stat danger">
              <div className="dense-stat-num">{activeCases.length}</div>
              <div className="dense-stat-label">Active</div>
            </div>
            <div className="dense-stat">
              <div className="dense-stat-num">{states.length}</div>
              <div className="dense-stat-label">States</div>
            </div>
            <div className="dense-stat">
              <div className="dense-stat-num">{species.length}</div>
              <div className="dense-stat-label">Species</div>
            </div>
          </div>
          <div className="dense-last-updated">Updated {lastUpdated}</div>

          <div className="dense-articles-top">
            <h3 className="dense-section-title">Latest from Meatingplace</h3>
            {loading && <div className="dense-articles-loading">Loading…</div>}
            {error && (
              <a href="https://www.meatingplace.com/?s=screwworm" target="_blank" rel="noopener noreferrer" className="dense-articles-error">
                View on Meatingplace.com →
              </a>
            )}
            {!loading && !error && articles.slice(0, 4).map((a, i) => (
              <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" className="dense-article-link">
                <span className="dense-article-date">{formatShortDate(a.date)}</span>
                <span className="dense-article-title">{stripHtml(a.title.rendered)}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Below fold: two columns */}
      <div className="dense-bottom">
        <div className="dense-bottom-left">
          <div className="dense-section">
            <h3 className="dense-section-title">Outbreak Timeline</h3>
            <div className="timeline">
              {allEvents.map((event, i) => (
                <div className="timeline-item" key={i}>
                  <div className={`timeline-dot ${event.type === 'international' ? 'international' : ''}`} />
                  <div className={`timeline-date ${event.type === 'international' ? 'international-date' : ''}`}>
                    {formatDate(event.date + 'T00:00:00')}
                  </div>
                  <div className="timeline-title">{event.title}</div>
                  {event.detail && <div className="timeline-detail">{event.detail}</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="dense-section">
            <h3 className="dense-section-title">Case Details</h3>
            <table className="dense-case-table">
              <thead>
                <tr>
                  <th>#</th><th>Date</th><th>Species</th><th>Location</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.confirmedCases.map(c => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{formatShortDate(c.date)}</td>
                    <td>{c.species}</td>
                    <td>{c.county} Co., {c.state}</td>
                    <td><span className={`dense-status ${c.status}`}>{c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dense-bottom-right">
          <div className="dense-section">
            <h3 className="dense-section-title">Trade & Movement Restrictions</h3>
            <div className="trade-cards">
              {data.tradeImpacts.map((impact, i) => {
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

          <div className="dense-section">
            <h3 className="dense-section-title">Species Breakdown</h3>
            <div className="species-bars">
              {data.speciesBreakdown.map((s, i) => (
                <div className="species-bar-row" key={i}>
                  <div className="species-bar-label">
                    <span>{s.species}</span>
                    <span className="species-bar-count">{s.count} case{s.count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="species-bar-track">
                    <div
                      className={`species-bar-fill ${s.species.toLowerCase().includes('bovine') ? 'cattle' : 'canine'}`}
                      style={{ width: `${s.percentage}%` }}
                    >
                      {s.percentage}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="dense-section">
            <h3 className="dense-section-title">More Coverage</h3>
            {!loading && !error && articles.map((a, i) => (
              <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" className="dense-full-article">
                <div className="news-date">{formatDate(a.date)}</div>
                <div className="news-title">{stripHtml(a.title.rendered)}</div>
                <div className="news-excerpt">{stripHtml(a.excerpt.rendered).slice(0, 140)}…</div>
              </a>
            ))}
            <a href="https://www.meatingplace.com/?s=screwworm" className="news-view-all" target="_blank" rel="noopener noreferrer">
              View All Coverage →
            </a>
          </div>
        </div>
      </div>

      {!isEmbed && (
        <footer className="site-footer">
          <p>
            Source: USDA APHIS, state animal health agencies, Meatingplace reporting<br />
            © 2026 <a href="https://www.meatingplace.com" target="_blank" rel="noopener noreferrer">Meatingplace</a>. For informational purposes only.
          </p>
        </footer>
      )}
    </div>
  );
}
