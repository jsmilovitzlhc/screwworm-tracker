import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2];
}

const sql = neon(process.env.DATABASE_URL);

// New case: #34 — Brewster County, TX (new county)
const newCases = [
  {
    id: 34,
    date: '2026-07-09',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Brewster',
    state: 'TX',
    lat: 29.81,
    lng: -103.25,
    status: 'active',
    notes: 'First Brewster County case; new county',
  },
];

// Date corrections to align with APHIS (GenomicEpi source)
const dateCorrections = [
  { id: 26, date: '2026-06-26' }, // was Jun 25
  { id: 27, date: '2026-06-27' }, // was Jun 28
  { id: 30, date: '2026-06-30' }, // was Jul 1
  { id: 31, date: '2026-06-30' }, // was Jul 1
  { id: 32, date: '2026-07-03' }, // was Jul 4
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

  // Apply date corrections to align with APHIS
  for (const fix of dateCorrections) {
    await sql`
      UPDATE screwworm_cases
      SET date = ${fix.date}, updated_at = NOW()
      WHERE id = ${fix.id}
    `;
    console.log(`Corrected case #${fix.id} date → ${fix.date}`);
  }

  await sql`SELECT setval('screwworm_cases_id_seq', (SELECT MAX(id) FROM screwworm_cases))`;

  // Update metadata timestamps
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-07-10T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-07-10T05:30:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated metadata timestamps');

  // Update internationalContext timeline
  const metaRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'internationalContext'`;
  if (metaRows.length > 0) {
    const ctx = typeof metaRows[0].value === 'string' ? JSON.parse(metaRows[0].value) : metaRows[0].value;

    // Fix existing timeline dates
    const dateMap = {
      '2026-06-25': '2026-06-26',
      '2026-06-28': '2026-06-27',
      '2026-07-01': '2026-06-30',
      '2026-07-04': '2026-07-03',
    };
    for (const entry of ctx.timeline || []) {
      if (dateMap[entry.date]) {
        // Update matching entries for cases 26, 27, 30-31, 32
        if (entry.event.includes('Case 26')) entry.date = '2026-06-26';
        if (entry.event.includes('Case 27')) entry.date = '2026-06-27';
        if (entry.event.includes('Cases 30')) entry.date = '2026-06-30';
        if (entry.event.includes('Case 32')) entry.date = '2026-07-03';
      }
    }

    // Add new timeline entry for case 34
    const newEntry = {
      date: '2026-07-09',
      event: 'Case 34: cattle in Brewster County — first Brewster County case; new county; US total reaches 34 with 24 active across 14 counties',
    };
    const hasEntry = (ctx.timeline || []).some(t => t.date === newEntry.date && t.event.includes('Case 34'));
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

  // Update speciesBreakdown (now 19 bovine with new case)
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('speciesBreakdown', ${JSON.stringify([
      { species: 'Bovine (Cattle)', count: 19, percentage: 56 },
      { species: 'Ovine (Sheep)', count: 10, percentage: 29 },
      { species: 'Caprine (Goats)', count: 3, percentage: 9 },
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
