import { useMemo, useEffect, useRef } from 'react';
import useCaseData from '../hooks/useCaseData';
import BareMap from '../components/BareMap';
import CasesByDay from '../components/CasesByDay';
import useArticles, { formatDate, formatShortDate, stripHtml } from '../hooks/useArticles';

export default function DenseLayout() {
  const isEmbed = new URLSearchParams(window.location.search).get('embed') === 'true';
  const rootRef = useRef(null);
  const { data } = useCaseData();
  const { articles, loading, error } = useArticles();

  useEffect(() => {
    if (!isEmbed || !rootRef.current) return;
    const send = () => {
      const h = rootRef.current.scrollHeight;
      window.parent.postMessage({ type: 'screwworm-resize', height: h }, '*');
    };
    send();
    const observer = new ResizeObserver(send);
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [isEmbed, loading]);

  const activeCases = useMemo(() => data.confirmedCases.filter(c => c.status === 'active'), [data]);
  const states = useMemo(() => [...new Set(data.confirmedCases.map(c => c.state))], [data]);
  const species = useMemo(() => [...new Set(data.confirmedCases.map(c => c.species))], [data]);

  const caseRank = useMemo(() => {
    const map = {};
    data.confirmedCases.forEach((c, i) => { map[c.id] = i + 1; });
    return map;
  }, [data]);

  const recentCases = useMemo(() =>
    [...data.confirmedCases].sort((a, b) => b.date.localeCompare(a.date)),
  [data]);

  const lastUpdated = new Date(data.lastUpdated).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
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
    <div ref={rootRef} className={`dense-layout ${isEmbed ? 'embed-mode' : ''}`}>
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

      {/* Bloomberg-style dark ticker bar */}
      <div className="bb-ticker">
        <div className="bb-ticker-live">
          <span className="bb-live-dot" />
          LIVE
        </div>
        <div className="bb-ticker-stats">
          <div className="bb-stat">
            <span className="bb-stat-num">{data.confirmedCases.length}</span>
            <span className="bb-stat-label">TOTAL</span>
          </div>
          <div className="bb-stat">
            <span className="bb-stat-num hot">{activeCases.length}</span>
            <span className="bb-stat-label">ACTIVE</span>
          </div>
          <div className="bb-stat">
            <span className="bb-stat-num">{states.length}</span>
            <span className="bb-stat-label">STATES</span>
          </div>
          <div className="bb-stat">
            <span className="bb-stat-num">{species.length}</span>
            <span className="bb-stat-label">SPECIES</span>
          </div>
        </div>
        <div className="bb-ticker-updated">Updated {lastUpdated}</div>
      </div>

      {/* Map + Case ticker side by side */}
      <div className="bb-main">
        <div className="bb-map">
          <BareMap
            cases={data.confirmedCases}
            quarantineZones={data.quarantineZones}
            height="100%"
            showSlider={true}
            showLegend={true}
          />
        </div>
        <div className="bb-cases">
          <div className="bb-cases-header">
            <span>Confirmed Cases</span>
            <span className="bb-cases-count">{data.confirmedCases.length}</span>
          </div>
          {recentCases.map(c => (
            <div className={`bb-case-row ${c.status}`} key={c.id}>
              <div className="bb-case-top">
                <span className="bb-case-id">#{caseRank[c.id]}</span>
                <span className="bb-case-animal">{c.species} — {c.animal}</span>
                <span className={`bb-case-status ${c.status}`}>{c.status}</span>
              </div>
              <div className="bb-case-bottom">
                <span className="bb-case-loc">{c.county} Co., {c.state}</span>
                <span className="bb-case-date">{formatShortDate(c.date)}</span>
              </div>
              <div className="bb-case-note">{c.notes}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Articles + Data panels */}
      <div className="bb-panels">
        <div className="bb-panel bb-news">
          <div className="bb-panel-header">Latest Updates from Meatingplace</div>
          {loading && <div className="bb-loading">Loading…</div>}
          {error && (
            <div className="bb-news-error">
              <span>Unable to load articles.</span>
              <a href="https://www.meatingplace.com/?s=screwworm" target="_blank" rel="noopener noreferrer" className="bb-news-fallback">
                View on Meatingplace.com →
              </a>
            </div>
          )}
          {!loading && !error && articles.length === 0 && (
            <div className="bb-news-error">
              <a href="https://www.meatingplace.com/?s=screwworm" target="_blank" rel="noopener noreferrer" className="bb-news-fallback">
                View on Meatingplace.com →
              </a>
            </div>
          )}
          {!loading && !error && articles.slice(0, 5).map((a, i) => (
            <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" className="bb-news-item">
              <span className="bb-news-date">{formatShortDate(a.date)}</span>
              <span className="bb-news-title">{stripHtml(a.title.rendered)}</span>
            </a>
          ))}
          <a href="https://www.meatingplace.com/?s=screwworm" className="bb-news-more" target="_blank" rel="noopener noreferrer">
            All Coverage →
          </a>
        </div>

        <div className="bb-panel bb-trade">
          <div className="bb-panel-header">Trade Restrictions</div>
          {data.tradeImpacts.slice(0, 4).map((impact, i) => (
            <div className="bb-trade-row" key={i}>
              <div className="bb-trade-entity">{impact.entity}</div>
              <div className="bb-trade-action">{impact.action}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline + Cases by Day (species stacked) */}
      <div className="bb-panels">
        <div className="bb-panel bb-timeline">
          <div className="bb-panel-header">Outbreak Timeline</div>
          <div className="bb-tl-scroll">
            {allEvents.map((event, i) => (
              <div className={`bb-tl-item ${event.type}`} key={i}>
                <span className={`bb-tl-dot ${event.type === 'international' ? 'intl' : ''}`} />
                <div className="bb-tl-content">
                  <span className="bb-tl-date">{formatShortDate(event.date + 'T00:00:00')}</span>
                  <span className="bb-tl-title">{event.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bb-panel bb-species">
          <CasesByDay cases={data.confirmedCases} />
        </div>
      </div>

      {!isEmbed && (
        <footer className="bb-footer">
          Source: USDA APHIS, state agencies, Meatingplace ·
          © 2026 <a href="https://www.meatingplace.com" target="_blank" rel="noopener noreferrer">Meatingplace</a>
        </footer>
      )}
    </div>
  );
}
