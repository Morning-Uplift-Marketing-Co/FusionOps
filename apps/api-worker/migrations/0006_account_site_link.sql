-- 0006: Link ops_accounts to sites
-- Each ads account should be associated with a specific site (landing page)
-- This enables Profile → Account → Site tracking in ProfileManager

ALTER TABLE ops_accounts ADD COLUMN site_id TEXT DEFAULT '';
ALTER TABLE ops_accounts ADD COLUMN site_domain TEXT DEFAULT '';

-- Also update ops_domains to properly track account + profile linkage
-- (these columns exist but weren't indexed)
CREATE INDEX IF NOT EXISTS idx_ops_domains_account ON ops_domains(account_id);
CREATE INDEX IF NOT EXISTS idx_ops_domains_profile ON ops_domains(profile_id);
CREATE INDEX IF NOT EXISTS idx_ops_accounts_site ON ops_accounts(site_id);
CREATE INDEX IF NOT EXISTS idx_ops_accounts_profile ON ops_accounts(profile_id);
