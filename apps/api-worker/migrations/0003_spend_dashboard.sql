-- 0003_spend_dashboard.sql

-- Opex (operating expenses)
CREATE TABLE IF NOT EXISTS opex (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,       -- proxy, anti_detect, tracking, hosting, domain, payment, other
    item_name TEXT NOT NULL,      -- NodeMaven, Multilogin, etc.
    monthly_cost REAL DEFAULT 0,
    billing_cycle TEXT DEFAULT 'monthly',  -- monthly, annual, one_time
    start_date TEXT,
    end_date TEXT,
    is_active INTEGER DEFAULT 1,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Monthly P&L snapshots
CREATE TABLE IF NOT EXISTS monthly_pnl (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL,           -- '2026-02'
    gross_revenue REAL DEFAULT 0,
    google_spend REAL DEFAULT 0,
    vat_amount REAL DEFAULT 0,
    lendingcard_fees REAL DEFAULT 0,
    total_cost_of_revenue REAL DEFAULT 0,
    gross_profit REAL DEFAULT 0,
    total_opex REAL DEFAULT 0,
    net_profit REAL DEFAULT 0,
    net_margin REAL DEFAULT 0,
    leads_submitted INTEGER DEFAULT 0,
    leads_sold INTEGER DEFAULT 0,
    leads_rejected INTEGER DEFAULT 0,
    active_accounts INTEGER DEFAULT 0,
    active_domains INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Reconciliation records
CREATE TABLE IF NOT EXISTS reconcile_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL,
    card_last4 TEXT NOT NULL,
    lc_date TEXT,
    lc_description TEXT DEFAULT '',
    lc_amount REAL DEFAULT 0,
    our_amount REAL DEFAULT 0,
    diff REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',  -- matched, diff, missing
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);
