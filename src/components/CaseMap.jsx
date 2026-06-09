import { useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function FitBounds({ bounds }) {
  const map = useMap();
  if (bounds) map.fitBounds(bounds, { padding: [40, 40] });
  return null;
}

export default function CaseMap({ cases, quarantineZones }) {
  const dates = useMemo(() => [...new Set(cases.map(c => c.date))].sort(), [cases]);
  const [dateIndex, setDateIndex] = useState(dates.length - 1);

  const filteredCases = useMemo(
    () => cases.filter(c => c.date <= dates[dateIndex]),
    [cases, dates, dateIndex]
  );

  const bounds = useMemo(() => {
    if (!cases.length) return null;
    const lats = cases.map(c => c.lat);
    const lngs = cases.map(c => c.lng);
    return [[Math.min(...lats) - 1, Math.min(...lngs) - 1], [Math.max(...lats) + 1, Math.max(...lngs) + 1]];
  }, [cases]);

  return (
    <div className="content-section">
      <div className="section-header">
        <span className="section-icon">🗺️</span>
        <h3>Confirmed Case Map</h3>
      </div>
      <div className="map-container">
        <MapContainer
          center={[30.5, -100]}
          zoom={6}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          <FitBounds bounds={bounds} />

          {quarantineZones.filter(z => z.active).map((zone, i) => (
            <Circle
              key={`qz-${i}`}
              center={zone.center}
              radius={zone.radiusMiles * 1609.34}
              pathOptions={{
                color: '#C47F17',
                fillColor: '#C47F17',
                fillOpacity: 0.08,
                weight: 1,
                dashArray: '6 4',
              }}
            >
              <Popup>
                <strong>{zone.name}</strong><br />
                Est. {new Date(zone.established + 'T00:00:00').toLocaleDateString()}<br />
                Radius: {zone.radiusMiles} mi
              </Popup>
            </Circle>
          ))}

          {filteredCases.map(c => (
            <CircleMarker
              key={c.id}
              center={[c.lat, c.lng]}
              radius={c.status === 'active' ? 10 : 7}
              pathOptions={{
                color: c.status === 'active' ? '#9B1B30' : '#999999',
                fillColor: c.status === 'active' ? '#9B1B30' : '#999999',
                fillOpacity: 0.7,
                weight: 2,
              }}
            >
              <Popup>
                <strong>Case #{c.id} — {c.species}</strong><br />
                {c.animal}, {c.county} Co., {c.state}<br />
                {new Date(c.date + 'T00:00:00').toLocaleDateString()}<br />
                <span className="popup-status">{c.status}</span><br />
                <em style={{ fontSize: '0.75rem', color: '#999' }}>{c.notes}</em>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div className="date-slider-container">
        <label>Timeline:</label>
        <input
          type="range"
          min={0}
          max={dates.length - 1}
          value={dateIndex}
          onChange={e => setDateIndex(Number(e.target.value))}
        />
        <span className="date-slider-value">
          {new Date(dates[dateIndex] + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' '}({filteredCases.length} case{filteredCases.length !== 1 ? 's' : ''})
        </span>
      </div>

      <div className="map-legend">
        <div className="legend-item"><div className="legend-dot active"></div> Active case</div>
        <div className="legend-item"><div className="legend-dot inactive"></div> Resolved</div>
        <div className="legend-item"><div className="legend-dot quarantine"></div> Quarantine zone</div>
      </div>
    </div>
  );
}
