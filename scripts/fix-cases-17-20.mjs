import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2];
}

const sql = neon(process.env.DATABASE_URL);

const correctedCases = [
  {
    id: 17,
    date: '2026-06-23',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Terrell',
    state: 'TX',
    lat: 30.2149,
    lng: -102.0862,
    status: 'active',
    notes: 'First Terrell County cattle case; part of 3-cattle cluster on same property',
  },
  {
    id: 18,
    date: '2026-06-23',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Terrell',
    state: 'TX',
    lat: 30.2049,
    lng: -102.0962,
    status: 'active',
    notes: 'Second Terrell County cattle case; same property cluster',
  },
  {
    id: 19,
    date: '2026-06-23',
    species: 'Bovine',
    animal: 'Cattle',
    county: 'Terrell',
    state: 'TX',
    lat: 30.2349,
    lng: -102.0662,
    status: 'active',
    notes: 'Third Terrell County cattle case; same property cluster',
  },
];

const newCase = {
  id: 20,
  date: '2026-06-23',
  species: 'Bovine',
  animal: 'Cattle',
  county: 'Medina',
  state: 'TX',
  lat: 29.6547,
  lng: -99.2785,
  status: 'active',
  notes: 'First Medina County case; cow in northwest Medina County; prompted Infested Zone 09',
};

try {
  const existing = await sql`SELECT MAX(id) as max_id, COUNT(*) as count FROM screwworm_cases`;
  console.log(`Current DB state: ${existing[0].count} cases, max id = ${existing[0].max_id}`);

  // Fix cases 17-19 (update county, species, coordinates, notes)
  for (const c of correctedCases) {
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

  // Add case 20
  const case20Exists = await sql`SELECT id FROM screwworm_cases WHERE id = ${newCase.id}`;
  if (case20Exists.length > 0) {
    await sql`
      UPDATE screwworm_cases
      SET date = ${newCase.date}, species = ${newCase.species}, animal = ${newCase.animal},
          county = ${newCase.county}, state = ${newCase.state}, lat = ${newCase.lat}, lng = ${newCase.lng},
          status = ${newCase.status}, notes = ${newCase.notes}, updated_at = NOW()
      WHERE id = ${newCase.id}
    `;
    console.log(`Updated case 20: ${newCase.animal} in ${newCase.county} County`);
  } else {
    await sql`
      INSERT INTO screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
      VALUES (${newCase.id}, ${newCase.date}, ${newCase.species}, ${newCase.animal}, ${newCase.county}, ${newCase.state}, ${newCase.lat}, ${newCase.lng}, ${newCase.status}, ${newCase.notes})
    `;
    console.log(`Inserted case 20: ${newCase.animal} in ${newCase.county} County`);
  }

  // Reset sequence
  await sql`SELECT setval('screwworm_cases_id_seq', (SELECT MAX(id) FROM screwworm_cases))`;

  // Rename Pecos/Terrell quarantine zone and update center
  await sql`
    UPDATE screwworm_quarantine_zones
    SET name = 'Terrell / Pecos County Zone', center_lat = 30.2249, center_lng = -102.0762
    WHERE name = 'Pecos / Terrell County Zone'
  `;
  console.log('Updated Terrell/Pecos quarantine zone center');

  // Add Medina/Uvalde/Bandera zone (Infested Zone 09) if not present
  const medinaZone = await sql`SELECT id FROM screwworm_quarantine_zones WHERE name LIKE '%Medina%'`;
  if (medinaZone.length === 0) {
    await sql`
      INSERT INTO screwworm_quarantine_zones (name, state, center_lat, center_lng, radius_miles, established_date, status)
      VALUES ('Medina / Uvalde / Bandera County Zone', 'TX', 29.6547, -99.2785, 15, '2026-06-24', 'active')
    `;
    console.log('Inserted Medina/Uvalde/Bandera quarantine zone (Infested Zone 09)');
  } else {
    console.log('Medina quarantine zone already exists');
  }

  // Update metadata timestamps
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-06-26T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-06-26T09:30:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated metadata timestamps');

  // Update internationalContext timeline
  const metaRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'internationalContext'`;
  if (metaRows.length > 0) {
    const ctx = typeof metaRows[0].value === 'string' ? JSON.parse(metaRows[0].value) : metaRows[0].value;
    // Remove old incorrect timeline entries for Jun 22-24
    ctx.timeline = (ctx.timeline || []).filter(t =>
      !['2026-06-23', '2026-06-24'].includes(t.date) ||
      !t.event.includes('Pecos') && !t.event.includes('Val Verde')
    );
    // Check if corrected entries exist
    const hasCorrect = ctx.timeline.some(t => t.date === '2026-06-23' && t.event.includes('Terrell'));
    if (!hasCorrect) {
      // Update Jun 22 entry
      const jun22Idx = ctx.timeline.findIndex(t => t.date === '2026-06-22');
      if (jun22Idx >= 0) {
        ctx.timeline[jun22Idx].event = '16th US case: goat in Terrell County, TX — first Terrell County detection';
      }
      // Add corrected Jun 23 entry
      ctx.timeline.push({
        date: '2026-06-23',
        event: 'Cases 17–20: 3 cattle on same Terrell County property (largest US cluster) plus cow in Medina County — US total reaches 20 with 17 active',
      });
      // Sort timeline by date
      ctx.timeline.sort((a, b) => a.date.localeCompare(b.date));
    }
    await sql`
      INSERT INTO screwworm_metadata (key, value) VALUES ('internationalContext', ${JSON.stringify(ctx)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
    console.log('Updated internationalContext timeline');
  }

  // Verify final state
  const final = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM screwworm_cases`;
  console.log(`\nFinal DB state: ${final[0].total} total cases, ${final[0].active} active`);

  // Show corrected cases
  const recent = await sql`SELECT id, date, species, animal, county, status FROM screwworm_cases WHERE id >= 16 ORDER BY id`;
  console.log('\nCases 16+:');
  for (const r of recent) {
    console.log(`  #${r.id}: ${r.date} ${r.animal} in ${r.county} Co. [${r.status}]`);
  }

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
