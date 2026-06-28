import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2];
}

const sql = neon(process.env.DATABASE_URL);

const newCase = {
  id: 26,
  date: '2026-06-25',
  species: 'Bovine',
  animal: 'Cattle',
  county: 'Jim Hogg',
  state: 'TX',
  lat: 27.0435,
  lng: -98.6932,
  status: 'active',
  notes: 'First Jim Hogg County case; significant southward expansion toward Mexico border; prompted Infested Zone 10',
};

try {
  const existing = await sql`SELECT MAX(id) as max_id, COUNT(*) as count FROM screwworm_cases`;
  console.log(`Current DB state: ${existing[0].count} cases, max id = ${existing[0].max_id}`);

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

  await sql`SELECT setval('screwworm_cases_id_seq', (SELECT MAX(id) FROM screwworm_cases))`;

  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-06-28T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-06-28T09:30:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated metadata timestamps');

  const metaRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'internationalContext'`;
  if (metaRows.length > 0) {
    const ctx = typeof metaRows[0].value === 'string' ? JSON.parse(metaRows[0].value) : metaRows[0].value;
    const hasJun25 = (ctx.timeline || []).some(t => t.date === '2026-06-25');
    if (!hasJun25) {
      ctx.timeline.push({
        date: '2026-06-25',
        event: 'Case 26: bovine in Jim Hogg County — first case in new county, significant southward expansion toward Mexico border; TAHC establishes Infested Zone 10 (Jim Hogg, Starr, Zapata counties)',
      });
      ctx.timeline.sort((a, b) => a.date.localeCompare(b.date));
    }
    await sql`
      INSERT INTO screwworm_metadata (key, value) VALUES ('internationalContext', ${JSON.stringify(ctx)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
    console.log('Updated internationalContext timeline');
  }

  const final = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active, COUNT(*) FILTER (WHERE status = 'inactive') as inactive FROM screwworm_cases`;
  console.log(`\nFinal DB state: ${final[0].total} total, ${final[0].active} active, ${final[0].inactive} inactive`);

  const recent = await sql`SELECT id, date, species, animal, county, status FROM screwworm_cases WHERE id >= 24 ORDER BY id`;
  console.log('\nRecent cases:');
  for (const r of recent) {
    console.log(`  #${r.id}: ${r.date?.toISOString?.()?.slice(0,10) || r.date} ${r.animal} in ${r.county} Co. [${r.status}]`);
  }

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
