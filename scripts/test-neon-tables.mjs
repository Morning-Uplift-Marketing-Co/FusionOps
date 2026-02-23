// Minimal Neon table test — isolate ghost-table bug
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL);

console.log('--- Step 1: Create a tiny test table ---');
await sql`CREATE TABLE IF NOT EXISTS _test_ping (id SERIAL PRIMARY KEY, msg TEXT)`;

console.log('--- Step 2: Insert a row ---');
await sql`INSERT INTO _test_ping (msg) VALUES ('hello from test')`;

console.log('--- Step 3: Query it back ---');
const rows = await sql`SELECT * FROM _test_ping`;
console.log('Rows:', rows);

console.log('--- Step 4: List public tables ---');
const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`;
console.log('Public tables:', tables.map(t => t.table_name));

console.log('--- Step 5: Check for V2 tables ---');
const v2 = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_name IN ('opex','monthly_pnl','reconcile_records','settings','daily_spend')
`;
console.log('V2 tables found:', v2.map(t => t.table_name));

console.log('--- Step 6: Cleanup ---');
await sql`DROP TABLE IF EXISTS _test_ping`;
console.log('Done!');
