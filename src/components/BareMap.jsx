import { useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function FitBounds({ bounds }) {
  const map = useMap();
  if (bounds) map.fitBounds(bounds, { padding: [40, 40] });
  return null;
}

export default function BareMap({ cases, quarantineZones, height = 400, showSlider = true, showLegend = true, lastChecked }) {
  const caseRank = useMemo(() => {
    const map = {};
    cases.forEach((c, i) => { map[c.id] = i + 1; });
    return map;
  }, [cases]);

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
    <div style={{ height, position: 'relative' }}>
      <div className="map-container" style={{ height: '100%' }}>
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
                <strong>Case #{caseRank[c.id]} — {c.species}</strong><br />
                {c.animal}, {c.county} Co., {c.state}<br />
                {new Date(c.date + 'T00:00:00').toLocaleDateString()}<br />
                <span className="popup-status">{c.status}</span><br />
                <em style={{ fontSize: '0.75rem', color: '#999' }}>{c.notes}</em>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {showSlider && (
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
      )}

      {showLegend && (
        <div className="map-legend">
          <div className="legend-item"><div className="legend-dot active"></div> Active case</div>
          <div className="legend-item"><div className="legend-dot inactive"></div> Resolved</div>
          <div className="legend-item"><div className="legend-dot quarantine"></div> Quarantine zone</div>
        </div>
      )}
      {lastChecked && (
        <div className="data-source-note">
          USDA dashboard checked {new Date(lastChecked).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          {' · '}No new cases since {dates.length > 0 ? new Date(dates[dates.length - 1] + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
        </div>
      )}
    </div>
  );
}
