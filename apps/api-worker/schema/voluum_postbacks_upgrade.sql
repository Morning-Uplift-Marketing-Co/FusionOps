-- Run once in Cloudflare D1 SQL console when voluum_postbacks already exists
-- with the old 9 columns only. Skip any line that errors with "duplicate column name".

ALTER TABLE voluum_postbacks ADD COLUMN voluum_domain TEXT;
ALTER TABLE voluum_postbacks ADD COLUMN forward_status TEXT;
ALTER TABLE voluum_postbacks ADD COLUMN forward_http_status INTEGER;
ALTER TABLE voluum_postbacks ADD COLUMN forward_error TEXT;
