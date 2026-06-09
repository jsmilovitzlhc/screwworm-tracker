import { useMemo } from 'react';
import data from './data/cases.json';
import CaseMap from './components/CaseMap';
import Timeline from './components/Timeline';
import TradeImpact from './components/TradeImpact';
import SpeciesBreakdown from './components/SpeciesBreakdown';
import StateResponse from './components/StateResponse';
import InternationalContext from './components/InternationalContext';
import NewsFeed from './components/NewsFeed';

function App() {
  const isEmbed = new URLSearchParams(window.location.search).get('embed') === 'true';

  const activeCases = useMemo(() => data.confirmedCases.filter(c => c.status === 'active'), []);
  const states = useMemo(() => [...new Set(data.confirmedCases.map(c => c.state))], []);
  const species = useMemo(() => [...new Set(data.confirmedCases.map(c => c.species))], []);

  const lastUpdated = new Date(data.lastUpdated).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div className={`app ${isEmbed ? 'embed-mode' : ''}`}>
      <header className="site-header">
        <div className="header-brand">
          <div>
            <h1>Screwworm Outbreak Tracker</h1>
            <div className="mp-tag">Meatingplace Data</div>
          </div>
        </div>
        <div className="alert-badge">
          <div className="alert-dot" />
          ACTIVE OUTBREAK
        </div>
      </header>

      <div className="hero-section">
        <h2>New World Screwworm — U.S. Outbreak 2026</h2>
        <p className="subtitle">
          Real-time tracking of confirmed Cochliomyia hominivorax cases in the United States
        </p>
        <p className="last-updated">Last updated: {lastUpdated}</p>
      </div>

      <div className="summary-cards">
        <div className="summary-card danger">
          <div className="number">{data.confirmedCases.length}</div>
          <div className="label">Total Cases</div>
        </div>
        <div className="summary-card danger">
          <div className="number">{activeCases.length}</div>
          <div className="label">Active Cases</div>
        </div>
        <div className="summary-card">
          <div className="number">{states.length}</div>
          <div className="label">States Affected</div>
        </div>
        <div className="summary-card">
          <div className="number">{species.length}</div>
          <div className="label">Species</div>
        </div>
      </div>

      <CaseMap cases={data.confirmedCases} quarantineZones={data.quarantineZones} />
      <Timeline cases={data.confirmedCases} internationalTimeline={data.internationalContext.timeline} />
      <TradeImpact impacts={data.tradeImpacts} />
      <SpeciesBreakdown breakdown={data.speciesBreakdown} />
      <StateResponse responses={data.stateResponses} />
      <InternationalContext context={data.internationalContext} />
      <NewsFeed />

      <div className="cta-section">
        <h3>Stay Informed on the Outbreak</h3>
        <p>Get real-time screwworm alerts and industry impact analysis from Meatingplace Data.</p>
        <form className="cta-form" onSubmit={e => { e.preventDefault(); alert('Thank you! You\'ll receive alerts as the situation develops.'); }}>
          <input type="email" placeholder="your@email.com" required />
          <button type="submit">Get Alerts</button>
        </form>
        <a href="https://www.meatingplace.com/data" className="cta-link" target="_blank" rel="noopener noreferrer">
          Explore Meatingplace Data →
        </a>
      </div>

      <footer className="site-footer">
        <p>
          © 2026 <a href="https://www.meatingplace.com" target="_blank" rel="noopener noreferrer">Meatingplace</a> — Data sourced from USDA APHIS, state animal health agencies. For informational purposes only.
        </p>
      </footer>
    </div>
  );
}

export default App;
