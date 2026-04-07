#!/usr/bin/env node
/**
 * validate-voluum-dns.mjs
 *
 * Pre-deploy check: ensures every deploy-config's voluumDomain
 * resolves to a valid CloudFront distribution (not track.voluum.com
 * or an unresolvable host).
 *
 * Can also auto-fix by looking up the correct CloudFront CNAME
 * from the Voluum API and updating Cloudflare DNS.
 *
 * Usage:
 *   node scripts/validate-voluum-dns.mjs                  # validate all
 *   node scripts/validate-voluum-dns.mjs --fix             # validate + auto-fix
 *   node scripts/validate-voluum-dns.mjs --domain x.com    # validate one domain
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIGS_DIR = path.resolve(__dirname, '..', 'deploy-configs');

const args = process.argv.slice(2);
const autoFix = args.includes('--fix');
const singleDomain = args.includes('--domain') ? args[args.indexOf('--domain') + 1] : null;

// ─── Helpers ───

function dnsLookup(hostname) {
  try {
    const out = execSync(`nslookup ${hostname} 8.8.8.8 2>&1`, { encoding: 'utf8', timeout: 10000 });
    // Check for NXDOMAIN or "can't find"
    if (/can't find|NXDOMAIN|Non-existent/i.test(out)) return { resolved: false, target: null };
    // Extract CNAME: Linux uses "canonical name", Windows uses "Aliases:" or "Name:" differs from query
    const cname = out.match(/canonical name\s*=\s*(\S+)/i);
    const aliases = out.match(/Aliases:\s*(\S+)/i);
    // Windows: "Name: d1xxx.cloudfront.net" when it's a CNAME (Name differs from queried hostname)
    const nameMatch = out.match(/Name:\s+(\S+)/i);
    const resolvedName = nameMatch ? nameMatch[1].replace(/\.$/, '') : null;
    const isCname = resolvedName && resolvedName !== hostname;
    const addr = out.match(/Address(?:es)?:\s*(\d+\.\d+\.\d+\.\d+)/g);
    // Priority: canonical name (Linux) > Name differs from query (Windows CNAME) > fallback
    // Note: Aliases on Windows is the QUERIED hostname, not the target
    const target = cname ? cname[1].replace(/\.$/, '')
      : isCname ? resolvedName
      : null;
    return {
      resolved: !!(target || (addr && addr.length > 1)),
      target,
    };
  } catch {
    return { resolved: false, target: null };
  }
}

async function getVoluumDomains() {
  const accessId = process.env.VOLUUM_ACCESS_KEY_ID;
  const accessKey = process.env.VOLUUM_ACCESS_KEY;
  if (!accessId || !accessKey) {
    console.warn('⚠ VOLUUM_ACCESS_KEY_ID / VOLUUM_ACCESS_KEY not set — skipping Voluum API lookup');
    return null;
  }

  try {
    // Auth
    const authResp = await fetch('https://api.voluum.com/auth/access/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessId, accessKey }),
    });
    const { token } = await authResp.json();

    // Get domains
    const domResp = await fetch('https://api.voluum.com/domain', {
      headers: { 'cwauth-token': token },
    });
    const data = await domResp.json();

    // Build map: domain → cloudfrontDomain
    const map = {};
    for (const d of (data.customDomains || [])) {
      if (d.cloudfrontDomain && d.sslCertificate?.status === 'ISSUED') {
        map[d.domain] = d.cloudfrontDomain;
      }
    }
    return map;
  } catch (err) {
    console.warn(`⚠ Voluum API error: ${err.message}`);
    return null;
  }
}

async function fixCloudfareDns(domain, correctCname) {
  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!cfToken) {
    console.warn('  ⚠ CLOUDFLARE_API_TOKEN not set — cannot auto-fix');
    return false;
  }

  try {
    // Get zone
    const zoneDomain = domain.split('.').slice(-2).join('.');
    const zoneResp = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${zoneDomain}`, {
      headers: { Authorization: `Bearer ${cfToken}` },
    });
    const zoneData = await zoneResp.json();
    const zoneId = zoneData.result?.[0]?.id;
    if (!zoneId) { console.warn(`  ⚠ Zone not found for ${zoneDomain}`); return false; }

    // Get record
    const recResp = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${domain}`, {
      headers: { Authorization: `Bearer ${cfToken}` },
    });
    const recData = await recResp.json();
    const record = recData.result?.[0];
    if (!record) { console.warn(`  ⚠ DNS record not found for ${domain}`); return false; }

    // Check if already correct
    if (record.content === correctCname) {
      console.log(`  ✓ ${domain} already points to ${correctCname}`);
      return true;
    }

    // Update
    const updateResp = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${record.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'CNAME', name: domain, content: correctCname, ttl: 1, proxied: false }),
    });
    const updateData = await updateResp.json();
    if (updateData.success) {
      console.log(`  ✅ Fixed: ${domain} → ${correctCname}`);
      return true;
    }
    console.warn(`  ⚠ Update failed: ${JSON.stringify(updateData.errors)}`);
    return false;
  } catch (err) {
    console.warn(`  ⚠ CF API error: ${err.message}`);
    return false;
  }
}

// ─── Main ───

const KNOWN_BAD_TARGETS = ['track.voluum.com', 'ssltrk.voluum.com', 'tr.voluum.com'];

async function main() {
  const files = fs.readdirSync(CONFIGS_DIR).filter(f => f.endsWith('.json'));
  const configs = files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(CONFIGS_DIR, f), 'utf8'));
    return { file: f, ...data };
  }).filter(c => c.voluumDomain);

  if (singleDomain) {
    const match = configs.filter(c => c.domain === singleDomain || c.voluumDomain === singleDomain);
    if (!match.length) { console.error(`No config found for ${singleDomain}`); process.exit(2); }
    configs.length = 0;
    configs.push(...match);
  }

  console.log(`\n🔍 Validating ${configs.length} Voluum tracking domains...\n`);

  // Fetch Voluum domain map (for auto-fix)
  const voluumMap = autoFix ? await getVoluumDomains() : null;

  let issues = 0;    // hard errors (DNS dead, bad CNAME) → exit 1
  let warnings = 0;  // soft warnings (missing config field) → exit 0
  let fixed = 0;

  for (const cfg of configs) {
    const { voluumDomain, voluumCfCname, domain, file } = cfg;
    process.stdout.write(`  ${voluumDomain.padEnd(40)}`);

    // 1. Check config has CloudFront CNAME (warning only, not a deploy blocker)
    if (!voluumCfCname) {
      console.log('⚠ missing voluumCfCname in config (warning)');
      warnings++;

      if (autoFix && voluumMap?.[voluumDomain]) {
        // Update config file
        const filePath = path.join(CONFIGS_DIR, file);
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        raw.voluumCfCname = voluumMap[voluumDomain];
        fs.writeFileSync(filePath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
        console.log(`    ✅ Config fixed: voluumCfCname = ${voluumMap[voluumDomain]}`);
        fixed++;
      }
      continue;
    }

    // 2. DNS resolution check
    const dns = dnsLookup(voluumDomain);
    if (!dns.resolved) {
      console.log(`❌ DNS does not resolve`);
      issues++;

      if (autoFix && voluumMap?.[voluumDomain]) {
        const ok = await fixCloudfareDns(voluumDomain, voluumMap[voluumDomain]);
        if (ok) fixed++;
      }
      continue;
    }

    // 3. Check not pointing to known bad targets
    if (dns.target && KNOWN_BAD_TARGETS.includes(dns.target)) {
      console.log(`❌ points to ${dns.target} (dead!)`);
      issues++;

      if (autoFix && voluumMap?.[voluumDomain]) {
        const ok = await fixCloudfareDns(voluumDomain, voluumMap[voluumDomain]);
        if (ok) fixed++;
      }
      continue;
    }

    // 4. Check CNAME matches config
    if (dns.target && dns.target !== voluumCfCname) {
      console.log(`⚠ DNS → ${dns.target}, config says ${voluumCfCname}`);
      issues++;
      continue;
    }

    console.log('✓ OK');
  }

  const summary = [];
  if (issues > 0) summary.push(`${issues} error(s)`);
  if (warnings > 0) summary.push(`${warnings} warning(s)`);
  if (fixed > 0) summary.push(`${fixed} fixed`);

  if (issues === 0 && warnings === 0) {
    console.log('\n✅ All good!\n');
  } else if (issues === 0) {
    console.log(`\n✅ OK with ${summary.join(', ')}\n`);
  } else {
    console.log(`\n❌ ${summary.join(', ')}${autoFix ? '' : ' — run with --fix to auto-repair'}\n`);
  }
  // Only fail on hard errors (DNS dead, bad CNAME), not warnings
  process.exit(issues > fixed ? 1 : 0);
}

main();
