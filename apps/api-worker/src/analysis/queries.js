// apps/api-worker/src/analysis/queries.js

export const Q = {
  ACCOUNTS_WITH_LINKS: `
    SELECT
      a.id, a.label, a.email, a.status, a.monthly_spend,
      a.proxy_ip, a.profile_id, a.site_id, a.site_domain,
      p.browser_type, p.fingerprint_os, p.last_ip, p.last_trust_score,
      p.proxy_provider, p.proxy_geo_country,
      py.fraud_score, py.trust_score, py.asn, py.isp, py.country,
      pm.last4, pm.bank_name, pm.lc_bin_uuid
    FROM ops_accounts a
    LEFT JOIN ops_profiles p ON a.profile_id = p.id
    LEFT JOIN ops_proxy_pool py ON py.assigned_to = a.id
    LEFT JOIN ops_payments pm ON a.payment_id = pm.id
    WHERE (?1 IS NULL OR a.status = ?1)
    ORDER BY a.created_at DESC
    LIMIT 200
  `,

  PROXY_POOL: `
    SELECT id, host, provider, country, city, asn, isp,
           fraud_score, trust_score, latency_ms, status, assigned_to, last_scan_at
    FROM ops_proxy_pool
    WHERE (?1 IS NULL OR trust_score >= ?1)
    ORDER BY trust_score DESC
    LIMIT 500
  `,

  PIXEL_EVENTS_SUMMARY: `
    SELECT
      domain,
      event,
      COUNT(*) as count,
      COUNT(DISTINCT session_id) as unique_sessions,
      COUNT(DISTINCT gclid) as unique_gclids,
      MIN(ts) as first_event,
      MAX(ts) as last_event
    FROM pixel_events
    WHERE domain = ?1
      AND ts >= unixepoch('now', ?2)
    GROUP BY domain, event
    ORDER BY count DESC
  `,

  LINK_AUDIT: `
    SELECT id, account_id, profile_id, card_uuid, proxy_ip,
           proxy_provider, proxy_geo, trust_score, action, details, created_at
    FROM ops_link_audit
    WHERE account_id = ?1
      AND created_at >= datetime('now', ?2)
    ORDER BY created_at DESC
    LIMIT 200
  `,

  BAN_EVENTS: `
    SELECT id, account_id, domain, ban_reason, ban_date,
           days_active, risk_score_at_ban, notes, created_at
    FROM ban_events
    WHERE (?1 IS NULL OR ban_date >= date('now', ?2))
    ORDER BY ban_date DESC
    LIMIT 100
  `,

  WRITE_RISK_SCORE: `
    INSERT INTO account_risk_scores
      (id, account_id, proxy_risk, isolation_score, traffic_quality,
       timeline_risk, verdict_score, verdict_status, scored_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))
  `,

  WRITE_AGENT_KPI: `
    INSERT INTO agent_kpis
      (id, agent_name, kpi_name, kpi_value, kpi_target, kpi_unit, recorded_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
  `,

  LATEST_AGENT_KPIS: `
    SELECT k1.*
    FROM agent_kpis k1
    INNER JOIN (
      SELECT agent_name, kpi_name, MAX(recorded_at) as latest
      FROM agent_kpis
      WHERE (?1 IS NULL OR agent_name = ?1)
      GROUP BY agent_name, kpi_name
    ) k2 ON k1.agent_name = k2.agent_name
         AND k1.kpi_name = k2.kpi_name
         AND k1.recorded_at = k2.latest
    ORDER BY k1.agent_name, k1.kpi_name
    LIMIT ?2
  `,

  WRITE_SPEND_HISTORY: `
    INSERT INTO spend_history
      (id, account_id, recorded_at, spend_24h, spend_30d,
       daily_budget, campaign_count, active_campaigns)
    VALUES (?1, ?2, date('now'), ?3, ?4, ?5, ?6, ?7)
    ON CONFLICT(account_id, recorded_at) DO UPDATE SET
      spend_24h       = excluded.spend_24h,
      spend_30d       = excluded.spend_30d,
      daily_budget    = excluded.daily_budget,
      campaign_count  = excluded.campaign_count,
      active_campaigns = excluded.active_campaigns
  `,

  GET_SPEND_HISTORY: `
    SELECT account_id, recorded_at, spend_24h, spend_30d,
           daily_budget, campaign_count, active_campaigns
    FROM spend_history
    WHERE account_id = ?1
    ORDER BY recorded_at DESC
    LIMIT ?2
  `,

  WRITE_BAN_EVENT: `
    INSERT INTO ban_events
      (id, account_id, domain, ban_reason, ban_date,
       days_active, risk_score_at_ban, notes, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))
  `,

  // Upsert from Google Ads Script sync
  UPSERT_ACCOUNT: `
    INSERT INTO ops_accounts
      (id, label, email, status, site_domain,
       monthly_spend, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      label         = excluded.label,
      email         = coalesce(nullif(excluded.email,''),    ops_accounts.email),
      status        = excluded.status,
      site_domain   = coalesce(nullif(excluded.site_domain,''), ops_accounts.site_domain),
      monthly_spend = excluded.monthly_spend
  `,
};
