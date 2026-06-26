import { useMemo, useState } from 'react';
import useCaseData from '../hooks/useCaseData';
import BareMap from '../components/BareMap';
import useArticles, { formatDate, stripHtml } from '../hooks/useArticles';

function Accordion({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="news-accordion">
      <button className="news-accordion-header" onClick={() => setOpen(!open)}>
        <span>{icon} {title}</span>
        <span className="news-accordion-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="news-accordion-body">{children}</div>}
    </div>
  );
}

export default function NewsLayout() {
  const isEmbed = new URLSearchParams(window.location.search).get('embed') === 'true';
  const { data } = useCaseData();
  const { articles, loading, error } = useArticles();

  const activeCases = useMemo(() => data.confirmedCases.filter(c => c.status === 'active'), [data]);
  const latestCase = data.confirmedCases[data.confirmedCases.length - 1];

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
    <div className={`news-layout ${isEmbed ? 'embed-mode' : ''}`}>
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

      {/* Hero banner */}
      <div className="news-hero">
        <div className="news-hero-stat">{data.confirmedCases.length}</div>
        <div className="news-hero-text">
          <h2>Confirmed U.S. Screwworm Cases</h2>
          <p>{activeCases.length} active across {[...new Set(data.confirmedCases.map(c => c.state))].length} states — latest: {latestCase.county} Co., {latestCase.state} ({latestCase.date})</p>
        </div>
      </div>

      {/* Article cards row */}
      <div className="news-articles-row">
        <h3 className="news-articles-row-title">Meatingplace Coverage</h3>
        {loading && <div className="news-loading">Loading articles…</div>}
        {error && (
          <div className="news-error">
            Unable to load articles.{' '}
            <a href="https://www.meatingplace.com/?s=screwworm" target="_blank" rel="noopener noreferrer">
              View on Meatingplace.com →
            </a>
          </div>
        )}
        {!loading && !error && articles.length === 0 && (
          <div className="news-error">
            <a href="https://www.meatingplace.com/?s=screwworm" target="_blank" rel="noopener noreferrer">
              View on Meatingplace.com →
            </a>
          </div>
        )}
        <div className="news-cards-horizontal">
          {!loading && !error && articles.slice(0, 4).map((a, i) => (
            <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" className="news-card-horiz">
              <div className="news-card-horiz-date">{formatDate(a.date)}</div>
              <div className="news-card-horiz-title">{stripHtml(a.title.rendered)}</div>
              <div className="news-card-horiz-excerpt">{stripHtml(a.excerpt.rendered).slice(0, 120)}…</div>
              <span className="news-card-horiz-link">Read on Meatingplace →</span>
            </a>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="news-map-section">
        <BareMap
          cases={data.confirmedCases}
          quarantineZones={data.quarantineZones}
          height={350}
          showSlider={true}
          showLegend={true}
        />
      </div>

      {/* Accordion sections */}
      <div className="news-accordions">
        <Accordion title="Outbreak Timeline" icon="📅" defaultOpen={false}>
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
        </Accordion>

        <Accordion title="Trade & Movement Restrictions" icon="🚫" defaultOpen={false}>
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
        </Accordion>

        <Accordion title="State & Federal Response" icon="🏛️" defaultOpen={false}>
          <div className="response-grid">
            {data.stateResponses.map((r, i) => (
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
        </Accordion>

        <Accordion title="Species Breakdown" icon="🐄" defaultOpen={false}>
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
          <div className="species-note" style={{ marginTop: '0.75rem' }}>
            <strong>Why non-livestock cases matter:</strong> Canine detections signal the screwworm fly is
            established in the environment — not just transported via livestock.
          </div>
        </Accordion>

        <Accordion title="International Context" icon="🌎" defaultOpen={false}>
          <div className="intl-stats">
            <div className="intl-stat">
              <div className="number">{data.internationalContext.totalAnimalCases.toLocaleString()}+</div>
              <div className="label">Animal Cases (MX/CA)</div>
            </div>
            <div className="intl-stat">
              <div className="number">{data.internationalContext.totalHumanCases.toLocaleString()}+</div>
              <div className="label">Human Cases</div>
            </div>
          </div>
          <div className="intl-countries">
            {data.internationalContext.affectedCountries.map((c, i) => (
              <span className="country-tag" key={i}>{c}</span>
            ))}
          </div>
        </Accordion>
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
