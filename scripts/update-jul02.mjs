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
    id: 30,
    date: '2026-07-01',
    species: 'Ovine',
    animal: 'Sheep',
    county: 'Crockett',
    state: 'TX',
    lat: 30.7525,
    lng: -101.3778,
    status: 'active',
    notes: 'Seventh Crockett County case; sheep',
  },
  {
    id: 31,
    date: '2026-07-01',
    species: 'Ovine',
    animal: 'Sheep',
    county: 'Crockett',
    state: 'TX',
    lat: 30.7025,
    lng: -101.4378,
    status: 'active',
    notes: 'Eighth Crockett County case; sheep',
  },
];

const statusChanges = [
  { id: 1, status: 'inactive' },
  { id: 2, status: 'inactive' },
  { id: 7, status: 'inactive' },
];

try {
  const existing = await sql`SELECT MAX(id) as max_id, COUNT(*) as count FROM screwworm_cases`;
  console.log(`Current DB state: ${existing[0].count} cases, max id = ${existing[0].max_id}`);

  for (const c of newCases) {
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
  }

  for (const change of statusChanges) {
    await sql`
      UPDATE screwworm_cases
      SET status = ${change.status}, updated_at = NOW()
      WHERE id = ${change.id}
    `;
    console.log(`Updated case #${change.id} status → ${change.status}`);
  }

  await sql`SELECT setval('screwworm_cases_id_seq', (SELECT MAX(id) FROM screwworm_cases))`;

  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-07-02T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-07-02T05:30:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated metadata timestamps');

  const metaRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'internationalContext'`;
  if (metaRows.length > 0) {
    const ctx = typeof metaRows[0].value === 'string' ? JSON.parse(metaRows[0].value) : metaRows[0].value;
    const newEntry = {
      date: '2026-07-01',
      event: 'Cases 30–31: two sheep in Crockett County, TX — US total reaches 31 with 22 active across 13 counties',
    };
    const hasEntry = (ctx.timeline || []).some(t => t.date === newEntry.date);
    if (!hasEntry) {
      ctx.timeline.push(newEntry);
    }
    ctx.timeline.sort((a, b) => a.date.localeCompare(b.date));
    await sql`
      INSERT INTO screwworm_metadata (key, value) VALUES ('internationalContext', ${JSON.stringify(ctx)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
    console.log('Updated internationalContext timeline');
  }

  // Update speciesBreakdown
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('speciesBreakdown', ${JSON.stringify([
      { species: 'Bovine (Cattle)', count: 17, percentage: 55 },
      { species: 'Ovine (Sheep)', count: 9, percentage: 29 },
      { species: 'Caprine (Goats)', count: 3, percentage: 10 },
      { species: 'Canine (Dogs)', count: 2, percentage: 6 },
    ])})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated speciesBreakdown');

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
