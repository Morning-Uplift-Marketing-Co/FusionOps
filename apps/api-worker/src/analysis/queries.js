// Analysis SQL constants — read-only queries + write helpers

export const ACCOUNTS_WITH_LINKS = `
  SELECT
    a.id,
    a.label,
    a.email,
    a.status,
    a.proxy_ip,
    a.profile_id,
    a.monthly_spend,
    a.site_id,
    a.site_domain,
    a.lifecycle_stage,
    a.risk_score,
    a.ban_reason,
    a.banned_at,
    COUNT(DISTINCT al.site_id) AS linked_sites
  FROM ops_accounts a
  LEFT JOIN ops_account_site_links al ON al.account_id = a.id
  GROUP BY a.id
  ORDER BY a.monthly_spend DESC
`;

export const PROXY_POOL = `
  SELECT
    proxy_ip,
    COUNT(*) AS account_count,
    GROUP_CONCAT(label, ', ') AS accounts,
    SUM(monthly_spend) AS total_spend,
    MAX(lifecycle_stage) AS worst_stage
  FROM ops_accounts
  WHERE proxy_ip IS NOT NULL AND proxy_ip != ''
  GROUP BY proxy_ip
  ORDER BY account_count DESC
`;

export const PIXEL_EVENTS_SUMMARY = `
  SELECT
    campaign_id,
    event_type,
    COUNT(*) AS event_count,
    COUNT(DISTINCT user_id) AS unique_users,
    MIN(created_at) AS first_seen,
    MAX(created_at) AS last_seen
  FROM events
  GROUP BY campaign_id, event_type
  ORDER BY event_count DESC
  LIMIT 200
`;

export const LINK_AUDIT = `
  SELECT
    l.id,
    l.account_id,
    l.site_id,
    l.created_at,
    a.label AS account_label,
    a.status AS account_status,
    a.lifecycle_stage,
    s.domain AS site_domain
  FROM ops_account_site_links l
  LEFT JOIN ops_accounts a ON a.id = l.account_id
  LEFT JOIN ops_sites s ON s.id = l.site_id
  ORDER BY l.created_at DESC
  LIMIT 500
`;

export const BAN_EVENTS = `
  SELECT *
  FROM ban_events
  ORDER BY occurred_at DESC
  LIMIT 200
`;

export const BAN_EVENTS_BY_ACCOUNT = `
  SELECT *
  FROM ban_events
  WHERE account_id = ?
  ORDER BY occurred_at DESC
`;

export const WRITE_RISK_SCORE = `
  INSERT INTO account_risk_scores (id, account_id, score, flags, computed_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(account_id) DO UPDATE SET
    score = excluded.score,
    flags = excluded.flags,
    computed_at = excluded.computed_at
`;

export const WRITE_AGENT_KPI = `
  INSERT INTO agent_kpis (id, agent_name, metric, value, recorded_at)
  VALUES (?, ?, ?, ?, ?)
`;

export const LATEST_RISK_SCORES = `
  SELECT
    r.account_id,
    r.score,
    r.flags,
    r.computed_at,
    a.label
  FROM account_risk_scores r
  LEFT JOIN ops_accounts a ON a.id = r.account_id
  ORDER BY r.score DESC
`;

export const AGENT_KPI_SUMMARY = `
  SELECT
    agent_name,
    metric,
    AVG(value) AS avg_value,
    MAX(value) AS max_value,
    MIN(value) AS min_value,
    COUNT(*) AS data_points,
    MAX(recorded_at) AS last_recorded
  FROM agent_kpis
  WHERE recorded_at >= datetime('now', '-7 days')
  GROUP BY agent_name, metric
  ORDER BY agent_name, metric
`;
