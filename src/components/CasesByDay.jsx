import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';

const SPECIES_COLORS = {
  Bovine: '#9B1B30',
  Caprine: '#2E6B4F',
  Canine: '#D4A017',
  Ovine: '#4A6FA5',
  Equine: '#7B4B94',
  Cervid: '#8A5A2B',
  Feline: '#C25E00',
  Avian: '#3E8E9E',
};

const SPECIES_ORDER = ['Bovine', 'Caprine', 'Canine', 'Ovine', 'Equine', 'Cervid', 'Feline', 'Avian'];

// A case counts from its confirmation date until the day it went inactive.
function isActiveOn(c, day) {
  if (c.date > day) return false;
  if (c.status === 'active') return true;
  return Boolean(c.inactiveDate) && day < c.inactiveDate;
}

// Only the bars worth reading get a number: today, the record high, and the earlier wave's peak.
function pickLabeledBars(data) {
  const last = data.length - 1;
  const peakIn = (rows) => rows.reduce((best, d, i) => (d.total > rows[best].total ? i : best), 0);
  const labeled = new Set([last]);
  const overall = peakIn(data);
  if (last - overall >= 14) labeled.add(overall);
  const earlier = data.slice(0, Math.max(last - 30, 1));
  const earlierPeak = peakIn(earlier);
  if (earlier[earlierPeak].total > 0) labeled.add(earlierPeak);
  return labeled;
}

export default function CasesByDay({ cases }) {
  const allSpecies = useMemo(() => {
    const s = new Set(cases.map(c => c.species));
    return [...SPECIES_ORDER.filter(sp => s.has(sp)), ...[...s].filter(sp => !SPECIES_ORDER.includes(sp))];
  }, [cases]);

  const chartData = useMemo(() => {
    const now = new Date();
    const end = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const data = [];

    for (let d = new Date(Date.UTC(2026, 5, 3)); d.getTime() <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const row = {
        date: key,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      };
      let total = 0;
      for (const sp of allSpecies) {
        const count = cases.filter(c => c.species === sp && isActiveOn(c, key)).length;
        row[sp] = count;
        total += count;
      }
      row.total = total;
      data.push(row);
    }
    return data;
  }, [cases, allSpecies]);

  const maxCases = Math.max(...chartData.map(d => d.total), 1);
  const labeledBars = useMemo(() => pickLabeledBars(chartData), [chartData]);
  const yMax = Math.ceil((maxCases + 3) / 15) * 15;

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
          <BarChart data={chartData} margin={{ top: 20, right: 12, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#666' }}
              tickLine={false}
              axisLine={{ stroke: '#E0E0E0' }}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#666' }}
              tickLine={false}
              axisLine={false}
              domain={[0, yMax]}
              ticks={Array.from({ length: yMax / 15 + 1 }, (_, i) => i * 15)}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(155, 27, 48, 0.06)' }} />
            {allSpecies.map((sp, i) => (
              <Bar
                key={sp}
                dataKey={sp}
                stackId="species"
                fill={SPECIES_COLORS[sp] ?? '#888'}
                radius={i === allSpecies.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                maxBarSize={40}
              />
            ))}
            {[...labeledBars].map(i => (
              <ReferenceDot
                key={chartData[i].date}
                x={chartData[i].label}
                y={chartData[i].total}
                r={0}
                label={{ value: chartData[i].total, position: 'top', style: { fontSize: 11, fontWeight: 600, fill: '#444' } }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 1rem', justifyContent: 'center', marginTop: '0.4rem' }}>
          {allSpecies.map(sp => (
            <div key={sp} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: '#666' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: SPECIES_COLORS[sp] ?? '#888', display: 'inline-block' }} />
              {sp}
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.65rem', color: '#888', textAlign: 'center', marginTop: '0.35rem' }}>
          APHIS does not publish inactive dates. A case's end date is the first APHIS update showing it inactive.
        </div>
      </div>
    </>
  );
}
