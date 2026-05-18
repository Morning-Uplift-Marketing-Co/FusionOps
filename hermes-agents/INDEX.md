# 4-Agent Hermes Team — Complete File Index

**Total**: 4 agents + 19 files + 1,032 lines of Python + 60KB documentation

## 📂 Agent Skills (Deployable to Hermes)

### AEGIS — Brand-Jack Detection
- **Files**: `AEGIS/SKILL.md` (config) + `AEGIS/run.py` (197 LOC)
- **Schedule**: Every 2 hours
- **Purpose**: Monitors unauthorized trademark keyword advertising in Google Ads
- **API**: SERP/Google/Ads/Advertisers/Live
- **Output**: Telegram alerts + `~/.hermes/aegis-state/alerts.jsonl`

### SCOUT — Competitor Ad Copy Intelligence
- **Files**: `SCOUT/SKILL.md` + `SCOUT/run.py` (229 LOC)
- **Schedule**: Daily 06:00 UTC
- **Purpose**: Daily diff of competitor ad copy (headlines, descriptions, URLs)
- **API**: SERP/Google/Ads/Search/Live
- **Output**: Telegram before/after alerts + `~/.hermes/scout-state/diffs.jsonl`

### HERALD — Trend & Reputation Monitor
- **Files**: `HERALD/SKILL.md` + `HERALD/run.py` (272 LOC)
- **Schedule**: Daily 08:00 UTC
- **Purpose**: Detects competitor trend spikes, reputation drops, complaint surges
- **APIs**: Google Trends Explore, Trustpilot Reviews, CFPB Complaints
- **Output**: Telegram alerts (trend/reputation/complaints) + `~/.hermes/herald-state/alerts.jsonl`

### ORACLE — Keyword Discovery
- **Files**: `ORACLE/SKILL.md` + `ORACLE/run.py` (334 LOC)
- **Schedule**: Weekly Monday 09:00 UTC
- **Purpose**: Discovers new trademark keyword variants with commercial intent
- **APIs**: Labs/Keyword Suggestions, Search Intent, Search Volume, Google Autocomplete, Reddit
- **Filters**: Brand name, commercial intent, min volume (100/mo), brand protection exclusion
- **Output**: Weekly Telegram report + `~/.hermes/oracle-state/keywords.jsonl`

---

## 📋 Documentation (In Order of Reading)

### 1. QUICKSTART.md (Start here)
- **Length**: 2 pages
- **Time**: 5 minutes
- **Content**: Copy-paste deployment commands
- **For**: Getting agents running ASAP

### 2. README.md (Full guide)
- **Length**: 12 pages
- **Time**: 20 minutes
- **Content**: Features, behavior, configuration, troubleshooting
- **For**: Understanding each agent + operations

### 3. ARCHITECTURE.md (System design)
- **Length**: 15 pages
- **Time**: 25 minutes
- **Content**: Data flows, state management, integration points
- **For**: Understanding how everything works together

### 4. BUILD_SUMMARY.md (What was built)
- **Length**: 8 pages
- **Time**: 10 minutes
- **Content**: Features list, decisions, costs, checklist
- **For**: Understanding scope + what's included

### 5. DEPLOYMENT_CHECKLIST.md (Step-by-step)
- **Length**: 8 pages
- **Time**: 30-40 minutes (actual deployment)
- **Content**: Detailed 10-step deployment guide + verification
- **For**: Deploying to production

---

## ⚙️ Configuration Files

### .env.example (1.2 KB)
Configuration template with required and optional variables

**Required**:
- `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` — API credentials
- `TRADEMARK_LIST` — Your brand names
- `COMPETITOR_LIST` — Competitor domains
- `APPROVED_ADVERTISERS` — Your domains only

**Optional**: Telegram bot tokens for each agent

---

## 🔧 Utility Scripts

### verify-setup.sh (4.7 KB)
Deployment verification script. Checks:
- .env file exists with required vars
- All 4 agents installed in ~/.hermes/skills/
- Hermes config has cron entries
- State directories exist
- Python requests library installed
- DataForSEO API credentials valid
- Telegram configured (if tokens set)

---

## 📊 Code Statistics

| Component | Lines | Purpose |
|-----------|-------|---------|
| AEGIS/run.py | 197 | Brand-jack detection |
| SCOUT/run.py | 229 | Ad copy intelligence |
| HERALD/run.py | 272 | Trend & reputation |
| ORACLE/run.py | 334 | Keyword discovery |
| **Total Python** | **1,032** | All agent logic |
| Documentation | **60 KB** | Guides + architecture |

---

## 🎯 Quick Start

1. Read QUICKSTART.md (5 min)
2. Fill .env with credentials (2 min)
3. Run verify-setup.sh (3 min)
4. Follow DEPLOYMENT_CHECKLIST.md (30 min)

---

**Status: Ready for production deployment** ✅

See QUICKSTART.md to begin.
