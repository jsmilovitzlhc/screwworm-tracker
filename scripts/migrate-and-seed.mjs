import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function migrate() {
  console.log('Creating tables...');

  await sql`
    CREATE TABLE IF NOT EXISTS screwworm_cases (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      species TEXT NOT NULL,
      animal TEXT NOT NULL,
      county TEXT NOT NULL,
      state TEXT NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      source_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS screwworm_trade_impacts (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      entity TEXT NOT NULL,
      action TEXT NOT NULL,
      scope TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS screwworm_quarantine_zones (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      state TEXT NOT NULL,
      center_lat DOUBLE PRECISION NOT NULL,
      center_lng DOUBLE PRECISION NOT NULL,
      radius_miles DOUBLE PRECISION NOT NULL,
      established_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS screwworm_metadata (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL
    )
  `;

  console.log('Tables created.');
}

async function seed() {
  const dataPath = join(__dirname, '..', 'src', 'data', 'cases.json');
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

  // Check if already seeded
  const existing = await sql`SELECT COUNT(*) as count FROM screwworm_cases`;
  if (parseInt(existing[0].count) > 0) {
    console.log('Database already seeded, skipping.');
    return;
  }

  console.log('Seeding cases...');
  for (const c of data.confirmedCases) {
    await sql`
      INSERT INTO screwworm_cases (id, date, species, animal, county, state, lat, lng, status, notes)
      VALUES (${c.id}, ${c.date}, ${c.species}, ${c.animal}, ${c.county}, ${c.state}, ${c.lat}, ${c.lng}, ${c.status}, ${c.notes})
    `;
  }
  // Reset sequence to be after the last seeded ID
  await sql`SELECT setval('screwworm_cases_id_seq', (SELECT MAX(id) FROM screwworm_cases))`;

  console.log('Seeding trade impacts...');
  for (const t of data.tradeImpacts) {
    await sql`
      INSERT INTO screwworm_trade_impacts (date, entity, action, scope, status)
      VALUES (${t.date}, ${t.entity}, ${t.action}, ${t.scope}, ${t.status || 'active'})
    `;
  }

  console.log('Seeding quarantine zones...');
  for (const q of data.quarantineZones) {
    await sql`
      INSERT INTO screwworm_quarantine_zones (name, state, center_lat, center_lng, radius_miles, established_date, status)
      VALUES (${q.name}, ${q.state}, ${q.center[0]}, ${q.center[1]}, ${q.radiusMiles}, ${q.established}, ${q.active ? 'active' : 'inactive'})
    `;
  }

  console.log('Seeding metadata...');
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('lastUpdated', ${JSON.stringify(data.lastUpdated)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('internationalContext', ${JSON.stringify(data.internationalContext)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO screwworm_metadata (key, value) VALUES ('stateResponses', ${JSON.stringify(data.stateResponses)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;

  console.log('Seed complete.');
}

try {
  await migrate();
  await seed();
  console.log('Done!');
} catch (err) {
  console.error('Migration/seed failed:', err);
  process.exit(1);
}
