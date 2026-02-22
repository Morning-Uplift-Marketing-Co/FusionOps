## Spend Dashboard v2 — Full Accounting

### Tab Structure

```
Spend Dashboard
├── Tab 1: Overview        (หน้าปัจจุบัน + ปรับปรุง)
├── Tab 2: Daily Log       (ทุกรายการรายวัน)
├── Tab 3: Per Account     (breakdown แต่ละ account)
├── Tab 4: Per Card        (LendingCard แต่ละใบ)
├── Tab 5: Per Domain      (site ไหนทำเงินดี)
├── Tab 6: Monthly P&L     (กำไรขาดทุน + ทำบัญชี)
├── Tab 7: Reconcile       (เทียบ LendingCard statement)
└── Tab 8: Opex            (ค่าใช้จ่ายอื่นๆ แยกต่างหาก)
```

------

### Tab 1: Overview (ปรับปรุงจากเดิม)

เพิ่มจากที่มีอยู่:

```
┌─────────────────────────────────────────────────────────────┐
│  💳 Spend Dashboard           [Today ▼] [7D 30D MTD] Sync  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌────────────┐  │
│  │ AD SPEND  │ │TRUE COST  │ │ REVENUE   │ │ TRUE ROI   │  │
│  │ $2,800    │ │ $3,204.60 │ │ $6,100    │ │ 90.3%      │  │
│  │ +$196 VAT │ │ +$98 LC   │ │ 145 conv  │ │ loaded     │  │
│  └───────────┘ └───────────┘ └───────────┘ └────────────┘  │
│                                                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌────────────┐  │
│  │ NET PROFIT│ │ AVG CPA   │ │ AVG PAYOUT│ │ REJECTION  │  │
│  │ $2,895.40 │ │ $22.10    │ │ $42.07    │ │ 12.3%      │  │
│  │ ▲ 15%     │ │ per lead  │ │ per sold  │ │ rate       │  │
│  └───────────┘ └───────────┘ └───────────┘ └────────────┘  │
│                                                             │
│  7 Day Trend          │  Top 5 Accounts (by profit)        │
│  [Revenue vs Cost]    │  1. Acc-03  +$820  bearloannow     │
│                       │  2. Acc-07  +$650  loanbears        │
│                       │  3. Acc-12  +$540  petcarefin       │
│                       │  4. Acc-01  +$490  quickcash        │
│                       │  5. Acc-05  +$395  vetpayments      │
│                       │                                     │
│  Recent LC Deposits   │  Worst 3 Accounts (negative ROI)   │
│  [current list]       │  1. Acc-09  -$120  loanfast         │
│                       │  2. Acc-15  -$45   pethelp          │
│                       │  3. Acc-11  -$30   cashnow          │
└─────────────────────────────────────────────────────────────┘
```

------

### Tab 2: Daily Log (ทุกรายการ)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📋 Daily Log                    [Feb 2026 ▼] [Export CSV] [Export XLS]│
├──────┬───────────┬──────────┬────────┬────────┬────────┬──────┬───────┤
│ Date │ Account   │ Domain   │ Spend  │ VAT    │ LC Fee │ Rev  │ P/L   │
├──────┼───────────┼──────────┼────────┼────────┼────────┼──────┼───────┤
│ 2/22 │ Acc-01    │ bearloan │ $320   │ $22.40 │ $11.98 │ $520 │ +$166 │
│ 2/22 │ Acc-01    │ bearloan │        │        │        │      │       │
│      │ Card *6977│ LC deposit: $354.38 (spend + VAT)   Fee: $12.40   │
│──────┼───────────┼──────────┼────────┼────────┼────────┼──────┼───────┤
│ 2/22 │ Acc-03    │ loanbear │ $280   │ $19.60 │ $10.49 │ $460 │ +$150 │
│ 2/22 │ Acc-03    │ loanbear │        │        │        │      │       │
│      │ Card *4568│ LC deposit: $310.08 (spend + VAT)   Fee: $10.85   │
│──────┼───────────┼──────────┼────────┼────────┼────────┼──────┼───────┤
│ ...  │ ...       │ ...      │ ...    │ ...    │ ...    │ ...  │ ...   │
├──────┴───────────┴──────────┴────────┴────────┴────────┴──────┴───────┤
│ DAILY TOTAL 2/22:    Spend $1,240  VAT $86.80  LC $43.40  Rev $1,860 │
│                      True Cost $1,370.20   Net Profit $489.80        │
└─────────────────────────────────────────────────────────────────────────┘
```

ทุกแถวมี: Google spend, VAT 7%, LendingCard fee 3.5%, Revenue, Profit/Loss — **สำหรับทำบัญชีรายวัน**

------

### Tab 3: Per Account

```
┌──────────────────────────────────────────────────────────────────────┐
│  👤 Per Account               [MTD ▼] [Feb 2026]  [Export]          │
├───────────┬──────────┬────────┬────────┬────────┬───────┬───────────┤
│ Account   │ Vertical │ Spend  │ TrueCst│ Revenue│ P/L   │ ROI       │
├───────────┼──────────┼────────┼────────┼────────┼───────┼───────────┤
│ Acc-01    │ Loan US  │ $4,200 │ $4,805 │ $7,800 │+$2,995│ 62.3% 🟢 │
│ Acc-03    │ Loan US  │ $3,800 │ $4,348 │ $6,200 │+$1,852│ 42.6% 🟢 │
│ Acc-07    │ Loan US  │ $2,900 │ $3,318 │ $5,100 │+$1,782│ 53.7% 🟢 │
│ Acc-12    │ Pet Fin  │ $1,600 │ $1,830 │ $3,400 │+$1,570│ 85.8% 🟢 │
│ Acc-05    │ Pet Fin  │ $1,200 │ $1,373 │ $2,100 │  +$727│ 53.0% 🟢 │
│ Acc-09    │ Loan US  │ $1,800 │ $2,060 │ $1,500 │  -$560│-27.2% 🔴 │
│ Acc-15    │ Pet Fin  │   $800 │   $915 │   $700 │  -$215│-23.5% 🔴 │
├───────────┼──────────┼────────┼────────┼────────┼───────┼───────────┤
│ TOTAL     │          │$16,300 │$18,649 │$26,800 │+$8,151│ 43.7%    │
└───────────┴──────────┴────────┴────────┴────────┴───────┴───────────┘

Click row → expand:
  ├── Daily breakdown for that account
  ├── Card used: *6977
  ├── Domain: bearloannow.com
  ├── Conversions: 87 submitted / 76 sold / 11 rejected (12.6% rejection)
  └── Avg payout: $42.07
```

------

### Tab 4: Per Card

```
┌──────────────────────────────────────────────────────────────────────┐
│  💳 Per Card                  [Feb 2026 ▼]  [Export] [Reconcile →]  │
├──────────┬───────────┬────────────┬──────────┬───────────┬──────────┤
│ Card     │ Account   │ Total Chrg │ LC Fee   │ Net Spend │ Status   │
├──────────┼───────────┼────────────┼──────────┼───────────┼──────────┤
│ *6977    │ Acc-01    │ $4,965.30  │ $173.79  │ $4,791.51 │ Active 🟢│
│ *4568    │ Acc-03    │ $4,491.96  │ $157.22  │ $4,334.74 │ Active 🟢│
│ *2341    │ Acc-07    │ $3,425.82  │ $119.90  │ $3,305.92 │ Active 🟢│
│ *8890    │ Acc-12    │ $1,890.30  │  $66.16  │ $1,824.14 │ Active 🟢│
│ *5512    │ Acc-09    │ $2,127.60  │  $74.47  │ $2,053.13 │ Paused ⚠️│
├──────────┼───────────┼────────────┼──────────┼───────────┼──────────┤
│ TOTAL    │ 5 cards   │$16,900.98  │ $591.54  │$16,309.44 │          │
└──────────┴───────────┴────────────┴──────────┴───────────┴──────────┘

Click row → expand:
  ├── Every transaction on this card
  ├── Date | Description | Amount | Fee
  ├── 2/22 | GOOGLE*ADS8343368603 | $644.58 | $22.56
  ├── 2/22 | International Trx Fee (SG) | $12.89 | $0.45
  ├── 2/21 | GOOGLE*ADS6109437792 | $644.58 | $22.56
  └── ...
```

------

### Tab 5: Per Domain

```
┌──────────────────────────────────────────────────────────────────────┐
│  🌐 Per Domain                [Feb 2026 ▼]  [Export]                │
├─────────────────┬──────────┬────────┬────────┬───────┬──────┬───────┤
│ Domain          │ Vertical │ Spend  │ TrueCst│ Rev   │ P/L  │ ROI   │
├─────────────────┼──────────┼────────┼────────┼───────┼──────┼───────┤
│ bearloannow.com │ Loan US  │ $4,200 │ $4,805 │$7,800 │+$2995│ 62% 🟢│
│ loanbears.com   │ Loan US  │ $3,800 │ $4,348 │$6,200 │+$1852│ 43% 🟢│
│ petcarefin.com  │ Pet Fin  │ $1,600 │ $1,830 │$3,400 │+$1570│ 86% 🟢│
│ quickcash.com   │ Loan US  │ $2,900 │ $3,318 │$5,100 │+$1782│ 54% 🟢│
│ loanfast.com    │ Loan US  │ $1,800 │ $2,060 │$1,500 │ -$560│-27% 🔴│
├─────────────────┼──────────┼────────┼────────┼───────┼──────┼───────┤
│ TOTAL           │          │$14,300 │$16,361 │$24,000│+$7639│ 47%   │
└─────────────────┴──────────┴────────┴────────┴───────┴──────┴───────┘

Click row → expand:
  ├── Which accounts run this domain
  ├── Daily revenue trend
  ├── Conversion rate
  └── Avg payout per lead
```

------

### Tab 6: Monthly P&L (ทำบัญชีสิ้นเดือน) -- หน้านี้ ซ่อนจาก Tab ได้ไหมต้องมี Paramitor ต่อท้าย URL ถึงเข้าได้

```
┌──────────────────────────────────────────────────────────────────────┐
│  📊 Monthly P&L — February 2026      [Jan ◄] [Feb] [► Mar]         │
│                                       [Export PDF] [Export Excel]    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ═══════════════════════════════════════════════════════              │
│  REVENUE                                                             │
│  ─────────────────────────────────────────────────────               │
│  Gross Lead Revenue (Voluum)              $26,800.00                 │
│    Loan US (LeadsGate)     $21,400.00                                │
│    Pet Finance             $ 5,400.00                                │
│                                                                      │
│  ═══════════════════════════════════════════════════════              │
│  COST OF REVENUE                                                     │
│  ─────────────────────────────────────────────────────               │
│  Google Ads Spend                         $16,300.00                 │
│    Loan US accounts (7)    $13,100.00                                │
│    Pet Finance accounts (3)$ 3,200.00                                │
│  VAT 7%                                   $ 1,141.00                 │
│  LendingCard Deposit Fees 3.5%            $   609.93                 │
│  ─────────────────────────────────────────────────────               │
│  Total Cost of Revenue                    $18,050.93                 │
│                                                                      │
│  ═══════════════════════════════════════════════════════              │
│  GROSS PROFIT                             $ 8,749.07                 │
│  Gross Margin                                32.6%                   │
│                                                                      │
│  ═══════════════════════════════════════════════════════              │
│  OPERATING EXPENSES (from Opex tab)                                  │
│  ─────────────────────────────────────────────────────               │
│  Proxy (NodeMaven + IPRoyal)              $    80.00                 │
│  Multilogin subscription                  $   100.00                 │
│  AdsPower subscription                    $    50.00                 │
│  Domains & Hosting (CF, Netlify)          $    30.00                 │
│  Voluum subscription                      $    99.00                 │
│  Other                                    $    25.00                 │
│  ─────────────────────────────────────────────────────               │
│  Total Opex                               $   384.00                 │
│                                                                      │
│  ═══════════════════════════════════════════════════════              │
│  NET PROFIT                               $ 8,365.07                 │
│  Net Margin                                  31.2%                   │
│  ═══════════════════════════════════════════════════════              │
│                                                                      │
│  ─────────────────────────────────────────────────────               │
│  KEY METRICS                                                         │
│  Total Leads Submitted          435                                  │
│  Total Leads Sold               382 (87.8% acceptance)               │
│  Total Leads Rejected            53 (12.2%)                          │
│  Average Payout per Sold        $70.16                               │
│  Average CPA (true cost)        $47.25                               │
│  Active Accounts                 10                                  │
│  Active Domains                   8                                  │
│  Active Cards                     5                                  │
│                                                                      │
│  ─────────────────────────────────────────────────────               │
│  MONTH-OVER-MONTH                                                    │
│  Revenue:    $26,800 vs $24,200 (Jan)  ▲ +10.7%                     │
│  Net Profit: $ 8,365 vs $ 7,100 (Jan)  ▲ +17.8%                    │
│  True ROI:   46.3% vs 41.2% (Jan)      ▲ +5.1pp                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

------

### Tab 7: Reconcile (เทียบ LendingCard statement)

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔄 Reconcile LendingCard — Feb 2026     [Upload Statement CSV]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Card *6977                                                          │
│  ┌────────┬──────────────────────┬───────────┬───────────┬─────────┐ │
│  │ Date   │ LC Statement         │ Our Record│ Diff      │ Status  │ │
│  ├────────┼──────────────────────┼───────────┼───────────┼─────────┤ │
│  │ 2/22   │ GOOGLE*ADS  $644.58  │ $644.58   │ $0.00     │ ✅ Match│ │
│  │ 2/22   │ Intl Fee    $12.89   │ $12.89    │ $0.00     │ ✅ Match│ │
│  │ 2/21   │ GOOGLE*ADS  $644.58  │ $644.58   │ $0.00     │ ✅ Match│ │
│  │ 2/21   │ Intl Fee    $12.89   │ $12.89    │ $0.00     │ ✅ Match│ │
│  │ 2/20   │ GOOGLE*ADS  $580.00  │ $577.32   │ -$2.68    │ ⚠️ Diff│ │
│  │ 2/19   │ Unknown     $15.00   │ —         │ +$15.00   │ ❌ Miss │ │
│  ├────────┼──────────────────────┼───────────┼───────────┼─────────┤ │
│  │ TOTAL  │ $1,910.94            │ $1,892.26 │ -$18.68   │ 99.0%  │ │
│  └────────┴──────────────────────┴───────────┴───────────┴─────────┘ │
│                                                                      │
│  Summary: 48 transactions | 45 matched ✅ | 2 diff ⚠️ | 1 missing ❌│
│  Match rate: 93.8%                                                   │
│  Unreconciled amount: $18.68                                         │
│  [Mark All Matched] [Flag for Review] [Add Missing to Records]      │
└──────────────────────────────────────────────────────────────────────┘
```

------

### Tab 8: Opex (Operating Expenses — แยกต่างหาก)

```
┌──────────────────────────────────────────────────────────────────────┐
│  🏢 Operating Expenses         [Feb 2026 ▼]  [+ Add Expense]       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Category          │ Item              │ Monthly │ Status            │
│  ──────────────────┼───────────────────┼─────────┼─────────────────  │
│  🔒 Proxy          │ NodeMaven         │ $50.00  │ Active            │
│  🔒 Proxy          │ IPRoyal           │ $30.00  │ Active            │
│  🌐 Anti-Detect    │ Multilogin X      │ $100.00 │ Active            │
│  🌐 Anti-Detect    │ AdsPower          │ $50.00  │ Active            │
│  📊 Tracking       │ Voluum            │ $99.00  │ Active            │
│  🌐 Hosting        │ Cloudflare Pro    │ $20.00  │ Active            │
│  🌐 Hosting        │ Netlify           │ $0.00   │ Free tier         │
│  🌐 Domain         │ 8 domains         │ $10.00  │ ~$1.25/domain/mo  │
│  💳 Payment        │ LendingCard sub   │ $25.00  │ Active            │
│  ──────────────────┼───────────────────┼─────────┼─────────────────  │
│  TOTAL OPEX        │                   │ $384.00 │                   │
│  ──────────────────┴───────────────────┴─────────┴─────────────────  │
│                                                                      │
│  📈 Opex History                                                     │
│  Jan: $359  │  Feb: $384  │  Trend: ▲ +7%                          │
│  Biggest increase: +$25 (added IPRoyal)                              │
│                                                                      │
│  ⚡ Opex as % of Revenue                                             │
│  Feb: $384 / $26,800 = 1.4% ← healthy (target < 5%)                │
└──────────────────────────────────────────────────────────────────────┘
```

------

### D1 Schema เพิ่ม

sql

~~~sql
-- Opex (operating expenses)
CREATE TABLE opex (
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
CREATE TABLE monthly_pnl (
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
CREATE TABLE reconcile_records (
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
```

### Endpoints เพิ่ม
```
GET  /api/spend/account/:id/daily     Per account daily breakdown
GET  /api/spend/card/:last4            Per card transactions
GET  /api/spend/domain/:domain         Per domain stats
GET  /api/spend/pnl/:month             Monthly P&L
POST /api/spend/pnl/generate           Generate P&L snapshot
POST /api/reconcile/upload             Upload LC statement CSV
GET  /api/reconcile/:month/:card       Reconcile results
POST /api/reconcile/match              Mark as matched
GET  /api/opex                         List all opex
POST /api/opex                         Add expense
PUT  /api/opex/:id                     Update expense
GET  /api/opex/history                 Monthly opex trend
~~~