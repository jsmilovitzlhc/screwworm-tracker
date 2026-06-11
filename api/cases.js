import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    const [cases, tradeImpacts, quarantineZones, metadataRows] = await Promise.all([
      sql`SELECT * FROM screwworm_cases ORDER BY date ASC, id ASC`,
      sql`SELECT * FROM screwworm_trade_impacts ORDER BY date ASC`,
      sql`SELECT * FROM screwworm_quarantine_zones ORDER BY established_date ASC`,
      sql`SELECT * FROM screwworm_metadata`,
    ]);

    const metadata = {};
    for (const row of metadataRows) {
      metadata[row.key] = row.value;
    }

    const confirmedCases = cases.map(c => ({
      id: c.id,
      date: toDateStr(c.date),
      species: c.species,
      animal: c.animal,
      county: c.county,
      state: c.state,
      lat: c.lat,
      lng: c.lng,
      status: c.status,
      notes: c.notes,
    }));

    const speciesMap = {};
    for (const c of confirmedCases) {
      const label = c.species === 'Bovine' ? 'Bovine (Cattle)' : c.species === 'Canine' ? 'Canine (Dogs)' : c.species;
      speciesMap[label] = (speciesMap[label] || 0) + 1;
    }
    const total = confirmedCases.length;
    const speciesBreakdown = Object.entries(speciesMap).map(([species, count]) => ({
      species,
      count,
      percentage: Math.round((count / total) * 100),
    }));

    const response = {
      lastUpdated: metadata.lastUpdated || new Date().toISOString(),
      confirmedCases,
      quarantineZones: quarantineZones.map(q => ({
        name: q.name,
        state: q.state,
        center: [q.center_lat, q.center_lng],
        radiusMiles: q.radius_miles,
        established: toDateStr(q.established_date),
        active: q.status === 'active',
      })),
      tradeImpacts: tradeImpacts.map(t => ({
        date: toDateStr(t.date),
        entity: t.entity,
        action: t.action,
        scope: t.scope,
        status: t.status,
      })),
      internationalContext: metadata.internationalContext || {},
      speciesBreakdown,
      stateResponses: metadata.stateResponses || [],
    };

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(response);
  } catch (err) {
    console.error('Error fetching cases:', err);
    return res.status(500).json({ error: 'Failed to fetch case data' });
  }
}

function toDateStr(val) {
  if (!val) return val;
  const s = typeof val === 'string' ? val : val.toISOString();
  return s.slice(0, 10);
}
