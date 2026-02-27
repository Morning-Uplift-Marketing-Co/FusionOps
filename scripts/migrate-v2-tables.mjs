// Attempt 2: Create V2 tables using tagged template literals
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL);

console.log('=== Creating V2 accounting tables via tagged templates ===\n');

// ----- OPEX -----
console.log('1. Creating opex...');
await sql`
  CREATE TABLE IF NOT EXISTS opex (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    item_name TEXT NOT NULL,
    monthly_cost NUMERIC(10, 2) DEFAULT 0,
    billing_cycle TEXT DEFAULT 'monthly',
    start_date DATE,
    end_date DATE,
    is_active INTEGER DEFAULT 1,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;
console.log('   opex OK');

// ----- MONTHLY P&L -----
console.log('2. Creating monthly_pnl...');
await sql`
  CREATE TABLE IF NOT EXISTS monthly_pnl (
    id SERIAL PRIMARY KEY,
    month TEXT NOT NULL,
    gross_revenue NUMERIC(10, 2) DEFAULT 0,
    google_spend NUMERIC(10, 2) DEFAULT 0,
    vat_amount NUMERIC(10, 2) DEFAULT 0,
    lendingcard_fees NUMERIC(10, 2) DEFAULT 0,
    total_cost_of_revenue NUMERIC(10, 2) DEFAULT 0,
    gross_profit NUMERIC(10, 2) DEFAULT 0,
    total_opex NUMERIC(10, 2) DEFAULT 0,
    net_profit NUMERIC(10, 2) DEFAULT 0,
    net_margin NUMERIC(5, 2) DEFAULT 0,
    leads_submitted INTEGER DEFAULT 0,
    leads_sold INTEGER DEFAULT 0,
    leads_rejected INTEGER DEFAULT 0,
    active_accounts INTEGER DEFAULT 0,
    active_domains INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;
console.log('   monthly_pnl OK');

// ----- RECONCILE RECORDS -----
console.log('3. Creating reconcile_records...');
await sql`
  CREATE TABLE IF NOT EXISTS reconcile_records (
    id SERIAL PRIMARY KEY,
    month TEXT NOT NULL,
    card_last4 TEXT NOT NULL,
    lc_date DATE,
    lc_description TEXT DEFAULT '',
    lc_amount NUMERIC(10, 2) DEFAULT 0,
    our_amount NUMERIC(10, 2) DEFAULT 0,
    diff NUMERIC(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'pending',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;
console.log('   reconcile_records OK');

// ----- VERIFY -----
console.log('\n=== Verifying ===');
const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`;
console.log('Public tables:', tables.map(t => t.table_name));

// Quick smoke test — insert + select from opex
console.log('\n=== Smoke test: insert into opex ===');
await sql`INSERT INTO opex (category, item_name, monthly_cost) VALUES ('proxy', 'NodeMaven', 49.00)`;
const opexRows = await sql`SELECT * FROM opex`;
console.log('Opex rows:', opexRows);

console.log('\nAll done!');
