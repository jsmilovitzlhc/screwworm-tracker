import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

const SPECIES_COLORS = {
  Bovine: '#9B1B30',
  Caprine: '#2E6B4F',
  Canine: '#D4A017',
  Ovine: '#4A6FA5',
};

const SPECIES_ORDER = ['Bovine', 'Caprine', 'Canine', 'Ovine'];

export default function CasesByDay({ cases }) {
  const allSpecies = useMemo(() => {
    const s = new Set(cases.map(c => c.species));
    return SPECIES_ORDER.filter(sp => s.has(sp));
  }, [cases]);

  const chartData = useMemo(() => {
    const start = new Date('2026-06-03T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const data = [];

    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const row = {
        date: key,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
      let total = 0;
      for (const sp of allSpecies) {
        const count = cases.filter(c => c.date <= key && c.status === 'active' && c.species === sp).length;
        row[sp] = count;
        total += count;
      }
      row.total = total;
      data.push(row);
    }
    return data;
  }, [cases, allSpecies]);

  const maxCases = Math.max(...chartData.map(d => d.total), 1);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);
    return (
      <div style={{
        fontFamily: "'Public Sans', sans-serif",
        fontSize: '0.8rem',
        border: '1px solid #E0E0E0',
        borderRadius: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        background: '#fff',
        padding: '0.5rem 0.65rem',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        {payload.filter(p => p.value > 0).map(p => (
          <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill, display: 'inline-block' }} />
            <span>{p.dataKey}: {p.value}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid #E0E0E0', marginTop: 4, paddingTop: 4, fontWeight: 600 }}>
          Total: {total} active case{total !== 1 ? 's' : ''}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="bb-panel-header">Active Cases by Day — Species Breakdown</div>
      <div className="cases-by-day-chart">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 20, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#666' }}
              tickLine={false}
              axisLine={{ stroke: '#E0E0E0' }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#666' }}
              tickLine={false}
              axisLine={false}
              domain={[0, maxCases + 1]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(155, 27, 48, 0.06)' }} />
            {allSpecies.map((sp, i) => (
              <Bar
                key={sp}
                dataKey={sp}
                stackId="species"
                fill={SPECIES_COLORS[sp]}
                radius={i === allSpecies.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                maxBarSize={40}
              >
                {i === allSpecies.length - 1 && (
                  <LabelList
                    dataKey="total"
                    position="top"
                    style={{ fontSize: 11, fontWeight: 600, fill: '#444' }}
                    formatter={(v) => v > 0 ? v : ''}
                  />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.4rem' }}>
          {allSpecies.map(sp => (
            <div key={sp} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: '#666' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: SPECIES_COLORS[sp], display: 'inline-block' }} />
              {sp}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
