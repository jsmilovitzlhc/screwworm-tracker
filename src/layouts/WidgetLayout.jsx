import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import useCaseData from '../hooks/useCaseData';

function FitBounds({ bounds }) {
  const map = useMap();
  if (bounds) map.fitBounds(bounds, { padding: [15, 15], animate: false });
  return null;
}

export default function WidgetLayout() {
  const { data } = useCaseData();

  const activeCases = useMemo(
    () => data.confirmedCases.filter(c => c.status === 'active'),
    [data]
  );

  const states = useMemo(
    () => [...new Set(data.confirmedCases.map(c => c.state))],
    [data]
  );

  const species = useMemo(
    () => [...new Set(data.confirmedCases.map(c => c.species))],
    [data]
  );

  const bounds = useMemo(() => {
    if (!data.confirmedCases.length) return null;
    const lats = data.confirmedCases.map(c => c.lat);
    const lngs = data.confirmedCases.map(c => c.lng);
    return [
      [Math.min(...lats) - 0.5, Math.min(...lngs) - 0.5],
      [Math.max(...lats) + 0.5, Math.max(...lngs) + 0.5],
    ];
  }, [data]);

  return (
    <div className="widget-root">
      <div className="widget-header">
        <div className="widget-header-left">
          <div className="widget-alert-dot" />
          <span className="widget-title">Meatingplace Screwworm Tracker</span>
        </div>
      </div>

      <div className="widget-stats">
        <div className="widget-stat">
          <span className="widget-stat-num">{data.confirmedCases.length}</span>
          <span className="widget-stat-label">Cases</span>
        </div>
        <div className="widget-stat-divider" />
        <div className="widget-stat">
          <span className="widget-stat-num">{activeCases.length}</span>
          <span className="widget-stat-label">Active</span>
        </div>
        <div className="widget-stat-divider" />
        <div className="widget-stat">
          <span className="widget-stat-num">{states.length}</span>
          <span className="widget-stat-label">States</span>
        </div>
        <div className="widget-stat-divider" />
        <div className="widget-stat">
          <span className="widget-stat-num">{species.length}</span>
          <span className="widget-stat-label">Species</span>
        </div>
      </div>

      <div className="widget-map">
        <MapContainer
          center={[30.5, -100]}
          zoom={6}
          scrollWheelZoom={false}
          dragging={false}
          zoomControl={false}
          attributionControl={false}
          doubleClickZoom={false}
          touchZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          <FitBounds bounds={bounds} />

          {data.quarantineZones.filter(z => z.active).map((zone, i) => (
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
            />
          ))}

          {data.confirmedCases.map(c => (
            <CircleMarker
              key={c.id}
              center={[c.lat, c.lng]}
              radius={c.status === 'active' ? 7 : 5}
              pathOptions={{
                color: c.status === 'active' ? '#9B1B30' : '#999999',
                fillColor: c.status === 'active' ? '#9B1B30' : '#999999',
                fillOpacity: 0.7,
                weight: 2,
              }}
            />
          ))}
        </MapContainer>
      </div>

      <a
        href="https://screwworm-tracker.vercel.app"
        target="_blank"
        rel="noopener noreferrer"
        className="widget-cta"
      >
        <svg className="widget-cta-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M4 2l12 9.5L10.5 13l4 7.5-2 1-4-7.5L4 18V2z" />
        </svg>
        Track Now
      </a>
    </div>
  );
}
