import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2];
}

const sql = neon(process.env.DATABASE_URL);

const newCase = {
  id: 29,
  date: '2026-06-30',
  species: 'Canine',
  animal: 'Dog',
  county: 'Pecos',
  state: 'TX',
  lat: 30.8894,
  lng: -103.4932,
  status: 'inactive',
  notes: 'First Pecos County case; second dog case in outbreak; domestic animal',
};

const statusChanges = [
  { id: 1, status: 'active' },
  { id: 6, status: 'inactive' },
  { id: 11, status: 'active' },
];

try {
  const existing = await sql`SELECT MAX(id) as max_id, COUNT(*) as count FROM screwworm_cases`;
  console.log(`Current DB state: ${existing[0].count} cases, max id = ${existing[0].max_id}`);

  // Add case #29
  const c = newCase;
  const exists = await sql`SELECT id FROM screwworm_cases WHERE id = ${c.id}`;
  if (exists.length > 0) {
    await sql`
      UPDATE screwworm_cases
      SET date = ${c.date}, species = ${c.species}, animal = ${c.animal},
          county = ${c.county}, state = ${c.state}, lat = ${c.lat}, lng = ${c.lng},
          status = ${c.status}, notes = ${c.notes}, updated_at = NOW()
      WHERE id = ${c.id}
    `;
    console.log(`Updated case ${c.id}: ${c.animal} in ${c.county} County`);
  } else {
    await sql`
      INSERT INTO screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
      VALUES (${c.id}, ${c.date}, ${c.species}, ${c.animal}, ${c.county}, ${c.state}, ${c.lat}, ${c.lng}, ${c.status}, ${c.notes})
    `;
    console.log(`Inserted case ${c.id}: ${c.animal} in ${c.county} County`);
  }

  // Update statuses
  for (const change of statusChanges) {
    await sql`
      UPDATE screwworm_cases
      SET status = ${change.status}, updated_at = NOW()
      WHERE id = ${change.id}
    `;
    console.log(`Updated case #${change.id} status → ${change.status}`);
  }

  await sql`SELECT setval('screwworm_cases_id_seq', (SELECT MAX(id) FROM screwworm_cases))`;

  // Update metadata timestamps
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-07-01T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-07-01T05:30:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated metadata timestamps');

  // Update internationalContext timeline
  const metaRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'internationalContext'`;
  if (metaRows.length > 0) {
    const ctx = typeof metaRows[0].value === 'string' ? JSON.parse(metaRows[0].value) : metaRows[0].value;
    const newEntries = [
      {
        date: '2026-06-29',
        event: 'Case 28: cattle in Uvalde County — US total reaches 28',
      },
      {
        date: '2026-06-30',
        event: 'Case 29: dog in Pecos County — second canine case; US total reaches 29 with 23 active across 13 counties',
      },
    ];
    for (const entry of newEntries) {
      const hasEntry = (ctx.timeline || []).some(t => t.date === entry.date);
      if (!hasEntry) {
        ctx.timeline.push(entry);
      }
    }
    ctx.timeline.sort((a, b) => a.date.localeCompare(b.date));
    await sql`
      INSERT INTO screwworm_metadata (key, value) VALUES ('internationalContext', ${JSON.stringify(ctx)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
    console.log('Updated internationalContext timeline');
  }

  const final = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active, COUNT(*) FILTER (WHERE status = 'inactive') as inactive FROM screwworm_cases`;
  console.log(`\nFinal DB state: ${final[0].total} total, ${final[0].active} active, ${final[0].inactive} inactive`);

  const recent = await sql`SELECT id, date, species, animal, county, status FROM screwworm_cases ORDER BY id`;
  console.log('\nAll cases:');
  for (const r of recent) {
    const d = typeof r.date === 'string' ? r.date.slice(0, 10) : r.date?.toISOString?.()?.slice(0, 10);
    console.log(`  #${r.id}: ${d} ${r.animal} in ${r.county} Co. [${r.status}]`);
  }

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
