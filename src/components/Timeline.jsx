export default function Timeline({ cases, internationalTimeline }) {
  const seenStates = new Set();
  const sortedCases = [...cases].sort((a, b) => a.date.localeCompare(b.date));
  const caseEvents = sortedCases.map(c => {
    const isNewState = !seenStates.has(c.state);
    seenStates.add(c.state);
    return {
      date: c.date,
      title: `${c.species} (${c.animal}) — ${c.county} Co., ${c.state}`,
      detail: c.notes,
      type: 'us-case',
      status: c.status,
      isNewState: isNewState && seenStates.size > 1,
    };
  });

  const allEvents = [
    ...internationalTimeline.map(e => ({
      date: e.date,
      title: e.event,
      type: 'international',
    })),
    ...caseEvents,
  ].sort((a, b) => a.date.localeCompare(b.date));

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="content-section">
      <div className="section-header">
        <span className="section-icon">📅</span>
        <h3>Outbreak Timeline</h3>
      </div>
      <div className="timeline">
        {allEvents.map((event, i) => (
          <div className="timeline-item" key={i}>
            <div className={`timeline-dot ${event.type === 'international' ? 'international' : ''}`} />
            <div className={`timeline-date ${event.type === 'international' ? 'international-date' : ''}`}>
              {formatDate(event.date)}
            </div>
            <div className="timeline-title">{event.title}</div>
            {event.detail && <div className="timeline-detail">{event.detail}</div>}
            {event.status === 'active' && (
              <span className={`timeline-badge ${event.isNewState ? 'badge-new-state' : 'badge-active'}`}>
                {event.isNewState ? 'New State' : 'Active'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
