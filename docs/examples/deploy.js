/**
 * LP Factory API - Deploy Adapter Examples (Node.js)
 *
 * Usage:
 *   node deploy.js vercel <projectName> <accessToken>
 *   node deploy.js netlify <siteName> <accessToken>
 *   node deploy.js cf-pages <projectName> <cfAccountId>
 *   node deploy.js cf-workers <scriptName> <cfAccountId>
 */

const API_BASE = 'https://lp-factory-api.songsawat-w.workers.dev';

// Optional: Set your API secret if authentication is enabled
// const API_SECRET = 'your-secret-here';

async function apiRequest(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  // if (API_SECRET) headers['Authorization'] = `Bearer ${API_SECRET}`;

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  return await response.json();
}

// Vercel
async function linkVercel(projectName, accessToken, teamId = null) {
  console.log(`Checking Vercel project: ${projectName}...`);
  const result = await apiRequest('/api/automation/deploy/vercel', 'POST', {
    projectName,
    accessToken,
    teamId,
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// Netlify
async function linkNetlify(siteName, accessToken) {
  console.log(`Checking Netlify site: ${siteName}...`);
  const result = await apiRequest('/api/automation/deploy/netlify', 'POST', {
    siteName,
    accessToken,
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// Cloudflare Pages
async function linkCFPages(projectName, cfAccountId) {
  console.log(`Checking CF Pages project: ${projectName}...`);
  const result = await apiRequest('/api/automation/deploy/cf-pages', 'POST', {
    projectName,
    cfAccountId,
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// Cloudflare Workers
async function linkCFWorkers(scriptName, cfAccountId) {
  console.log(`Checking CF Workers script: ${scriptName}...`);
  const result = await apiRequest('/api/automation/deploy/cf-workers', 'POST', {
    scriptName,
    cfAccountId,
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// CLI
async function main() {
  const [,, command, ...args] = process.argv;

  switch (command) {
    case 'vercel': {
      const [projectName, accessToken, teamId] = args;
      if (!projectName || !accessToken) {
        console.error('Usage: node deploy.js vercel <projectName> <accessToken> [teamId]');
        process.exit(1);
      }
      await linkVercel(projectName, accessToken, teamId);
      break;
    }

    case 'netlify': {
      const [siteName, accessToken] = args;
      if (!siteName || !accessToken) {
        console.error('Usage: node deploy.js netlify <siteName> <accessToken>');
        process.exit(1);
      }
      await linkNetlify(siteName, accessToken);
      break;
    }

    case 'cf-pages': {
      const [projectName, cfAccountId] = args;
      if (!projectName || !cfAccountId) {
        console.error('Usage: node deploy.js cf-pages <projectName> <cfAccountId>');
        process.exit(1);
      }
      await linkCFPages(projectName, cfAccountId);
      break;
    }

    case 'cf-workers': {
      const [scriptName, cfAccountId] = args;
      if (!scriptName || !cfAccountId) {
        console.error('Usage: node deploy.js cf-workers <scriptName> <cfAccountId>');
        process.exit(1);
      }
      await linkCFWorkers(scriptName, cfAccountId);
      break;
    }

    default:
      console.log('LP Factory Deploy Adapter API Examples\n');
      console.log('Usage: node deploy.js [platform] [args]\n');
      console.log('Platforms:');
      console.log('  vercel <projectName> <accessToken> [teamId]');
      console.log('  netlify <siteName> <accessToken>');
      console.log('  cf-pages <projectName> <cfAccountId>');
      console.log('  cf-workers <scriptName> <cfAccountId>\n');
      console.log('Examples:');
      console.log('  node deploy.js vercel my-app VERCEL_TOKEN');
      console.log('  node deploy.js netlify my-site NETLIFY_TOKEN');
      console.log('  node deploy.js cf-pages my-app ACCOUNT_ID');
      console.log('  node deploy.js cf-workers my-worker ACCOUNT_ID');
      process.exit(1);
  }
}

main().catch(console.error);
