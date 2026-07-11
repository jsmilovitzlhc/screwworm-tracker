import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2];
}

const sql = neon(process.env.DATABASE_URL);

// New case: #35 — Goat in Crockett County, TX
const newCases = [
  {
    id: 35,
    date: '2026-07-10',
    species: 'Caprine',
    animal: 'Goat',
    county: 'Crockett',
    state: 'TX',
    lat: 30.7125,
    lng: -101.4478,
    status: 'active',
    notes: 'Eleventh Crockett County case; goat',
  },
];

try {
  const existing = await sql`SELECT MAX(id) as max_id, COUNT(*) as count FROM screwworm_cases`;
  console.log(`Current DB state: ${existing[0].count} cases, max id = ${existing[0].max_id}`);

  // Insert new case
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

  await sql`SELECT setval('screwworm_cases_id_seq', (SELECT MAX(id) FROM screwworm_cases))`;

  // Update metadata timestamps
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-07-11T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-07-11T05:30:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated metadata timestamps');

  // Update internationalContext timeline
  const metaRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'internationalContext'`;
  if (metaRows.length > 0) {
    const ctx = typeof metaRows[0].value === 'string' ? JSON.parse(metaRows[0].value) : metaRows[0].value;

    // Add new timeline entry for case 35
    const newEntry = {
      date: '2026-07-10',
      event: 'Case 35: goat in Crockett County — eleventh Crockett County case; US total reaches 35 with 25 active across 14 counties',
    };
    const hasEntry = (ctx.timeline || []).some(t => t.date === newEntry.date && t.event.includes('Case 35'));
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

  // Update speciesBreakdown — Caprine goes from 3 → 4 (35 total cases)
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('speciesBreakdown', ${JSON.stringify([
      { species: 'Bovine (Cattle)', count: 19, percentage: 54 },
      { species: 'Ovine (Sheep)', count: 10, percentage: 29 },
      { species: 'Caprine (Goats)', count: 4, percentage: 11 },
      { species: 'Canine (Dogs)', count: 2, percentage: 6 },
    ])})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated speciesBreakdown');

  // Final verification
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
