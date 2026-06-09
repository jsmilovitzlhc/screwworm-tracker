import { useMemo } from 'react';
import data from '../data/cases.json';
import BareMap from '../components/BareMap';
import useArticles, { formatDate, formatShortDate, stripHtml } from '../hooks/useArticles';

export default function CompactLayout() {
  const isEmbed = new URLSearchParams(window.location.search).get('embed') === 'true';
  const { articles, loading, error } = useArticles();

  const activeCases = useMemo(() => data.confirmedCases.filter(c => c.status === 'active'), []);
  const states = useMemo(() => [...new Set(data.confirmedCases.map(c => c.state))], []);
  const species = useMemo(() => [...new Set(data.confirmedCases.map(c => c.species))], []);

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
    <div className={`compact-layout ${isEmbed ? 'embed-mode' : ''}`}>
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

      {/* Horizontal stat bar */}
      <div className="compact-stat-bar">
        <div className="compact-stat danger">
          <span className="compact-stat-num">{data.confirmedCases.length}</span>
          <span className="compact-stat-label">Cases</span>
        </div>
        <div className="compact-stat-divider" />
        <div className="compact-stat danger">
          <span className="compact-stat-num">{activeCases.length}</span>
          <span className="compact-stat-label">Active</span>
        </div>
        <div className="compact-stat-divider" />
        <div className="compact-stat">
          <span className="compact-stat-num">{states.length}</span>
          <span className="compact-stat-label">States</span>
        </div>
        <div className="compact-stat-divider" />
        <div className="compact-stat">
          <span className="compact-stat-num">{species.length}</span>
          <span className="compact-stat-label">Species</span>
        </div>
      </div>

      {/* Three equal columns */}
      <div className="compact-columns">
        {/* Left: Map */}
        <div className="compact-col compact-col-map">
          <BareMap
            cases={data.confirmedCases}
            quarantineZones={data.quarantineZones}
            height="100%"
            showSlider={false}
            showLegend={false}
          />
        </div>

        {/* Center: Timeline + Articles woven in */}
        <div className="compact-col compact-col-center">
          <h3 className="compact-col-title">Timeline & Coverage</h3>
          <div className="compact-feed">
            {allEvents.map((event, i) => (
              <div className="compact-feed-item" key={`event-${i}`}>
                <div className={`compact-feed-dot ${event.type === 'international' ? 'intl' : ''}`} />
                <div className="compact-feed-content">
                  <div className={`compact-feed-date ${event.type === 'international' ? 'intl' : ''}`}>
                    {formatShortDate(event.date + 'T00:00:00')}
                  </div>
                  <div className="compact-feed-title">{event.title}</div>
                  {event.detail && <div className="compact-feed-detail">{event.detail}</div>}
                </div>
              </div>
            ))}

            {/* Articles woven in */}
            {!loading && !error && articles.slice(0, 4).map((a, i) => (
              <a key={`article-${i}`} href={a.link} target="_blank" rel="noopener noreferrer" className="compact-feed-article">
                <div className="compact-feed-dot article" />
                <div className="compact-feed-content">
                  <div className="compact-feed-date article-date">
                    {formatShortDate(a.date)} · Meatingplace
                  </div>
                  <div className="compact-feed-title article-title">{stripHtml(a.title.rendered)}</div>
                </div>
              </a>
            ))}
            {loading && <div style={{ fontSize: '0.75rem', color: '#999', padding: '0.5rem 0' }}>Loading articles…</div>}
          </div>
        </div>

        {/* Right: Trade Impact + Response */}
        <div className="compact-col compact-col-right">
          <h3 className="compact-col-title">Trade Impact</h3>
          <div className="compact-trade-list">
            {data.tradeImpacts.map((impact, i) => (
              <div className="compact-trade-item" key={i}>
                <div className="compact-trade-entity">{impact.entity}</div>
                <div className="compact-trade-action">{impact.action}</div>
                <div className="compact-trade-scope">{impact.scope}</div>
              </div>
            ))}
          </div>

          <h3 className="compact-col-title" style={{ marginTop: '1rem' }}>Response</h3>
          {data.stateResponses.map((r, i) => (
            <div className="compact-response" key={i}>
              <div className="compact-response-state">{r.state}</div>
              <ul className="compact-response-list">
                {r.actions.map((action, j) => (
                  <li key={j}>{action}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* International context — only section below fold */}
      <div className="compact-intl">
        <div className="compact-intl-inner">
          <span className="compact-intl-label">International:</span>
          <span>{data.internationalContext.totalAnimalCases.toLocaleString()}+ animal cases</span>
          <span className="compact-intl-sep">·</span>
          <span>{data.internationalContext.totalHumanCases.toLocaleString()}+ human cases</span>
          <span className="compact-intl-sep">·</span>
          <span>{data.internationalContext.affectedCountries.join(', ')}</span>
        </div>
      </div>

      {!isEmbed && (
        <footer className="site-footer compact-footer">
          <p>
            Source: USDA APHIS, state animal health agencies, Meatingplace reporting · © 2026{' '}
            <a href="https://www.meatingplace.com" target="_blank" rel="noopener noreferrer">Meatingplace</a>
          </p>
        </footer>
      )}
    </div>
  );
}
