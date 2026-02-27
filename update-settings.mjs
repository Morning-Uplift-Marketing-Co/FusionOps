/**
 * Complete Settings Update
 * Fill in all necessary settings for deployment
 */

const API_BASE = 'http://localhost:4325/api';

// Complete settings with all required values
const completeSettings = {
  // Cloudflare (ALREADY SET)
  cfAccountId: '***CF_ACCOUNT_ID_REMOVED***',
  cfApiToken: '***CF_TOKEN_REMOVED***',

  // Neon (ALREADY SET)
  neonUrl: 'postgresql://neondb_owner:***NEON_PWD_REMOVED***@ep-old-hall-ai9n8868-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',

  // Voluum (FROM ENV)
  voluumAccessKeyId: 'a174e5d6-97ec-4d63-b3e3-aea76bb333ff',
  voluumAccessKey: '-oO6QO-DVXqi5CC3RdBO1Ny-fc1XJKvMOhjO',

  // LendingCard API (FROM ENV)
  lcToken: 'b2fbf1ca07e3c4d7f91a8d84b47b6bad78644c59',

  // Optional deployment targets (set to empty if not used)
  netlifyToken: '',
  netlifyTeamSlug: '',
  vercelToken: '',
  vpsHost: '',
  vpsPort: '22',
  vpsUser: '',
  vpsPath: '',
  vpsAuthMethod: 'key',
  vpsKey: '',
  vpsWorkerUrl: '',

  // GitHub (optional, for Git deployments)
  githubToken: '',
  githubRepoOwner: '',
  githubRepoName: '',
  githubRepoBranch: 'main',
  githubDeployWorkflow: 'deploy-sites.yml',

  // D1 Database (optional)
  d1AccountId: '',
  d1DatabaseId: '',
  d1ApiToken: '',

  // MultiLogin (optional)
  mlToken: '',
  mlEmail: '',
  mlPassword: '',
  mlFolderId: '',

  // Anthropic API (optional, for AI features)
  geminiKey: '',
  apiKey: '',
};

console.log('🔧 Updating Complete Settings\n');
console.log('📋 Settings to update:');

// Show what we're setting
Object.entries(completeSettings).forEach(([key, value]) => {
  const displayValue = value.includes('://') || value.includes('-')
    ? value.slice(0, 20) + '...'
    : value;
  const status = value ? '✓' : '○';
  console.log(`  ${status} ${key}: ${displayValue}`);
});

async function updateSettings() {
  try {
    console.log('\n🚀 Sending settings to API...');

    const response = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(completeSettings),
    });

    if (!response.ok) {
      throw new Error(`Failed to update settings: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Settings updated successfully!');

    console.log('\n📊 Current Settings:');
    console.log('  Cloudflare Account:', result.cfAccountId?.slice(0, 8) + '...');
    console.log('  Neon Status:', result.neonUrl ? '✓ Connected' : '○ Not set');
    console.log('  Voluum Status:', result.voluumAccessKey ? '✓ Set' : '○ Not set');
    console.log('  LendingCard Status:', result.lcToken ? '✓ Set' : '○ Not set');

    console.log('\n✨ Settings complete! Ready for deployment.');

  } catch (error) {
    console.error('\n❌ Error updating settings:', error.message);
    console.error('Stack:', error.stack);
  }
}

updateSettings();
