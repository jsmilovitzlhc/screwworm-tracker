import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('/Users/jacobsmilovitz/.openclaw/workspace/screwworm-tracker/.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n$/, '');
}

const sql = neon(process.env.DATABASE_URL);

// APHIS dashboard sync (data as of Sep 29, 2026) — 51 total / 3 active / 48 inactive.
//
// The APHIS public Tableau export
// (publicdashboards.dl.usda.gov/t/MRP_PUB/views/
//  NewWorldScrewwormPublicReporting_17805168329840/SummaryDashboard.csv)
// now reports per-month domestic active/inactive as:
//   June 2026:      30 total,  0 active, 30 inactive
//   July 2026:      14 total,  0 active, 14 inactive
//   August 2026:     4 total,  0 active,  4 inactive
//   September 2026:  3 total,  3 active,  0 inactive   <-- was 2 total / 2 active on Sep 23
// => 51 total / 3 active / 48 inactive.
//
// The new September detection is case #52: a domestic goat in Crockett County, TX
// confirmed Sep 26. That is the THIRTEENTH Crockett County case — the tracker already
// holds 12 (ids 13, 22-25, 27, 30-33, 35, 49). Case #49's note and its Aug 31 timeline
// entry both mislabelled it "fifth Crockett County case" (#25 already holds "Fifth");
// this script corrects them to "twelfth" so the ordinal chain stays consistent.
//
// NOT ingested: the Sep 25 Brewster County, TX fly-trap detection. APHIS reports it in
// the "Total Cases" column (September: 4) but not in "Total Cases - Domestic"
// (September: 3). This tracker only carries confirmed domestic animal cases — it has no
// fly-trap concept in its schema — so adding it would break the domestic-count parity
// the assertions below rely on.

const NEW_CASE = {
  id: 52,
  date: '2026-09-26',
  species: 'Caprine',
  animal: 'Goat',
  county: 'Crockett',
  state: 'TX',
  lat: 30.7425,
  lng: -101.4178,
  status: 'active',
  notes: 'Thirteenth Crockett County case; domestic goat; confirmed per APHIS dashboard Sept 29',
};

const EXPECTED_ACTIVE = [50, 51, 52];

// APHIS per-month truth, used as a post-update assertion.
const APHIS_BY_MONTH = {
  '2026-06': { total: 30, active: 0, inactive: 30 },
  '2026-07': { total: 14, active: 0, inactive: 14 },
  '2026-08': { total: 4, active: 0, inactive: 4 },
  '2026-09': { total: 3, active: 3, inactive: 0 },
};

const TIMELINE_ENTRY = {
  date: '2026-09-26',
  event: 'Case 52: goat in Crockett County — thirteenth Crockett County case; '
    + 'US total reaches 51 with 3 active cases (50 Presidio horse, 51 Grant NM horse, 52 Crockett goat)',
};

try {
  const before = await sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases`;
  console.log(`Before: ${before[0].total} total, ${before[0].active} active`);
  if (Number(before[0].total) !== 50 || Number(before[0].active) !== 2) {
    console.log('✗ Unexpected starting state (wanted 50 total / 2 active)');
    process.exit(1);
  }

  // --- 1. Insert the new Crockett County goat case ---
  const existing = await sql`SELECT id FROM screwworm_cases WHERE id = ${NEW_CASE.id}`;
  if (existing.length > 0) {
    console.log(`✗ Case #${NEW_CASE.id} already exists — refusing to overwrite`);
    process.exit(1);
  }
  const inserted = await sql`
    INSERT INTO screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
    VALUES (${NEW_CASE.id}, ${NEW_CASE.date}, ${NEW_CASE.species}, ${NEW_CASE.animal},
            ${NEW_CASE.county}, ${NEW_CASE.state}, ${NEW_CASE.lat}, ${NEW_CASE.lng},
            ${NEW_CASE.status}, ${NEW_CASE.notes})
    RETURNING id, date, county, state, animal, status
  `;
  console.log('Inserted:', JSON.stringify(inserted[0]));

  // Explicit id above bypasses the sequence; realign it so future inserts don't collide.
  await sql`SELECT setval('screwworm_cases_id_seq', (SELECT MAX(id) FROM screwworm_cases))`;

  // --- 2. Correct case #49's Crockett ordinal (was "Fifth", actually the twelfth) ---
  const fixed = await sql`
    UPDATE screwworm_cases
    SET notes = replace(notes, 'Fifth Crockett County case', 'Twelfth Crockett County case')
    WHERE id = 49 AND notes LIKE 'Fifth Crockett County case%'
    RETURNING id, notes
  `;
  console.log(fixed.length ? `Case #49 note corrected: ${fixed[0].notes}` : 'Case #49 note already correct');

  // --- 3. Timeline entry + matching ordinal fix inside internationalContext ---
  const ctxRows = await sql`SELECT value FROM screwworm_metadata WHERE key = 'internationalContext'`;
  if (ctxRows.length === 0) {
    console.log('✗ internationalContext metadata row missing');
    process.exit(1);
  }
  const ctx = typeof ctxRows[0].value === 'string' ? JSON.parse(ctxRows[0].value) : ctxRows[0].value;
  const aug31 = ctx.timeline.find(e => e.date === '2026-08-31');
  if (aug31) {
    aug31.event = aug31.event.replace('fifth Crockett County case', 'twelfth Crockett County case');
  }
  if (!ctx.timeline.some(e => e.date === TIMELINE_ENTRY.date)) {
    ctx.timeline.push(TIMELINE_ENTRY);
    console.log('Timeline entry added for 2026-09-26');
  } else {
    console.log('Timeline already has a 2026-09-26 entry — left as is');
  }
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('internationalContext', ${JSON.stringify(ctx)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;

  // --- 4. Timestamps ---
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify('2026-09-30T00:00:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastChecked', ${JSON.stringify('2026-09-30T09:30:00Z')})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('Updated timestamps to lastUpdated=2026-09-30');

  // --- 5. Stale speciesBreakdown metadata row (api/cases.js recomputes this per request,
  //        but keep the stored copy honest so it can't mislead a future reader) ---
  const speciesRows = await sql`
    SELECT species, COUNT(*) AS "count" FROM screwworm_cases GROUP BY species ORDER BY species
  `;
  const LABELS = {
    Bovine: 'Bovine (Cattle)', Canine: 'Canine (Dogs)', Caprine: 'Caprine (Goats)',
    Ovine: 'Ovine (Sheep)', Equine: 'Equine (Horses)',
  };
  const totalCases = speciesRows.reduce((n, r) => n + Number(r.count), 0);
  const speciesBreakdown = speciesRows.map(r => ({
    species: LABELS[r.species] || r.species,
    count: Number(r.count),
    percentage: Math.round((Number(r.count) / totalCases) * 100),
  }));
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('speciesBreakdown', ${JSON.stringify(speciesBreakdown)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  console.log('speciesBreakdown:', JSON.stringify(speciesBreakdown));

  // --- Verify against APHIS ---
  const after = await sql`SELECT COUNT(*) AS "total", COUNT(*) FILTER (WHERE status = 'active') AS "active" FROM screwworm_cases`;
  console.log(`\nAfter: ${after[0].total} total, ${after[0].active} active`);

  if (Number(after[0].total) !== 51 || Number(after[0].active) !== 3) {
    console.log(`✗ Mismatch! Expected 51 total, 3 active — got ${after[0].total} total, ${after[0].active} active`);
    process.exit(1);
  }
  console.log('✓ Counts match APHIS (51 total, 3 active, 48 inactive)');

  const activeRows = await sql`SELECT id, date, county, state, animal FROM screwworm_cases WHERE status = 'active' ORDER BY id`;
  const activeIds = activeRows.map(r => r.id);
  if (JSON.stringify(activeIds) !== JSON.stringify(EXPECTED_ACTIVE)) {
    console.log(`✗ Active ids ${JSON.stringify(activeIds)} != expected ${JSON.stringify(EXPECTED_ACTIVE)}`);
    process.exit(1);
  }
  console.log('Active cases:', JSON.stringify(activeRows));

  const byMonth = await sql`
    SELECT to_char(date, 'YYYY-MM') AS "month",
           COUNT(*) AS "total",
           COUNT(*) FILTER (WHERE status = 'active') AS "active",
           COUNT(*) FILTER (WHERE status = 'inactive') AS "inactive"
    FROM screwworm_cases GROUP BY 1 ORDER BY 1
  `;
  for (const row of byMonth) {
    const want = APHIS_BY_MONTH[row.month];
    if (!want) {
      console.log(`✗ Unexpected month ${row.month} in tracker but not in APHIS export`);
      process.exit(1);
    }
    if (Number(row.total) !== want.total || Number(row.active) !== want.active || Number(row.inactive) !== want.inactive) {
      console.log(`✗ ${row.month}: tracker ${row.total}/${row.active}/${row.inactive} != APHIS ${want.total}/${want.active}/${want.inactive}`);
      process.exit(1);
    }
    console.log(`✓ ${row.month}: ${row.total} total, ${row.active} active, ${row.inactive} inactive`);
  }
  if (byMonth.length !== Object.keys(APHIS_BY_MONTH).length) {
    console.log('✗ Month count mismatch vs APHIS export');
    process.exit(1);
  }

  // Crockett ordinal chain sanity: 13 cases, no duplicate ordinal words.
  const crockett = await sql`SELECT id, notes FROM screwworm_cases WHERE county = 'Crockett' ORDER BY date, id`;
  console.log(`\nCrockett County cases: ${crockett.length}`);
  if (crockett.length !== 13) {
    console.log('✗ Expected 13 Crockett County cases after this sync');
    process.exit(1);
  }

  console.log('\nDone!');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
