import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2];
}

const sql = neon(process.env.DATABASE_URL);

const newCases = [
  {
    id: 17,
    date: '2026-06-23',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Pecos',
    state: 'TX',
    lat: 30.7848,
    lng: -103.3932,
    status: 'active',
    notes: 'First Pecos County case; prompted quarantine zone expansion',
  },
  {
    id: 18,
    date: '2026-06-23',
    species: 'Caprine',
    animal: 'Goat',
    county: 'Edwards',
    state: 'TX',
    lat: 29.9427,
    lng: -100.2356,
    status: 'active',
    notes: 'Sixth Edwards County case; third caprine detection',
  },
  {
    id: 19,
    date: '2026-06-24',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Val Verde',
    state: 'TX',
    lat: 29.8830,
    lng: -100.8960,
    status: 'active',
    notes: 'First Val Verde County case',
  },
];

const newQuarantineZone = {
  name: 'Pecos / Terrell County Zone',
  state: 'TX',
  center_lat: 30.7848,
  center_lng: -103.3932,
  radius_miles: 15,
  established_date: '2026-06-22',
  status: 'active',
};

try {
  // Check current case count
  const existing = await sql`SELECT MAX(id) as max_id, COUNT(*) as count FROM screwworm_cases`;
  console.log(`Current DB state: ${existing[0].count} cases, max id = ${existing[0].max_id}`);

  // Insert new cases (skip if already present)
  for (const c of newCases) {
    const exists = await sql`SELECT id FROM screwworm_cases WHERE id = ${c.id}`;
    if (exists.length > 0) {
      console.log(`Case ${c.id} already exists, skipping`);
      continue;
    }
    await sql`
      INSERT INTO screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
      VALUES (${c.id}, ${c.date}, ${c.species}, ${c.animal}, ${c.county}, ${c.state}, ${c.lat}, ${c.lng}, ${c.status}, ${c.notes})
    `;
    console.log(`Inserted case ${c.id}: ${c.animal} in ${c.county} County, ${c.state}`);
  }

  // Reset sequence
  await sql`SELECT setval('screwworm_cases_id_seq', (SELECT MAX(id) FROM screwworm_cases))`;

  // Insert quarantine zone if not present
  const zoneExists = await sql`SELECT id FROM screwworm_quarantine_zones WHERE name = ${newQuarantineZone.name}`;
  if (zoneExists.length === 0) {
    await sql`
      INSERT INTO screwworm_quarantine_zones (name, state, center_lat, center_lng, radius_miles, established_date, status)
      VALUES (${newQuarantineZone.name}, ${newQuarantineZone.state}, ${newQuarantineZone.center_lat}, ${newQuarantineZone.center_lng}, ${newQuarantineZone.radius_miles}, ${newQuarantineZone.established_date}, ${newQuarantineZone.status})
    `;
    console.log('Inserted Pecos/Terrell quarantine zone');
  } else {
    console.log('Pecos/Terrell quarantine zone already exists');
  }

  // Update metadata
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-06-24T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-06-24T14:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;

  // Update internationalContext timeline
  const metaRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'internationalContext'`;
  if (metaRows.length > 0) {
    const ctx = typeof metaRows[0].value === 'string' ? JSON.parse(metaRows[0].value) : metaRows[0].value;
    const hasJun23 = ctx.timeline?.some(t => t.date === '2026-06-23');
    if (!hasJun23) {
      ctx.timeline = ctx.timeline || [];
      ctx.timeline.push(
        { date: '2026-06-23', event: 'Cases 17–18: cattle in Pecos County (new county) and goat in Edwards County, TX' },
        { date: '2026-06-24', event: '19th US case: cattle in Val Verde County, TX — US total reaches 19 with 16 active' }
      );
      await sql`
        INSERT INTO screwworm_metadata (key, value) VALUES ('internationalContext', ${JSON.stringify(ctx)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
      console.log('Updated internationalContext timeline');
    }
  }

  // Verify final state
  const final = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`\nFinal DB state: ${final[0].total} total cases, ${final[0].active} active`);

  console.log('Done!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
