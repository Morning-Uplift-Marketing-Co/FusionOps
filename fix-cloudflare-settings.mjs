/**
 * Fix Cloudflare Settings
 * Auto-fill all required Cloudflare credentials via API
 */

const API_BASE = 'http://localhost:4321/api';

// Complete Cloudflare settings from environment
const cfSettings = {
  // CRITICAL: Locked values from environment
  cfAccountId: 'ef771cfd6197dedb36bb3cea22ecf4fc',
  cfApiToken: '8dTwYeTJF93WbhAyi2FzhUe8PV3rIEta5b8Pq5MQ',

  // Optional additional settings
  d1AccountId: '',
  d1DatabaseId: '',
  d1ApiToken: '',
};

console.log('🔧 Fixing Cloudflare Settings\n');
console.log('📋 Settings to apply:');

Object.entries(cfSettings).forEach(([key, value]) => {
  const display = key === 'cfApiToken'
    ? value.slice(0, 20) + '...'
    : value;
  const status = value ? '✓' : '○';
  console.log(`  ${status} ${key}: ${display || '(empty)'}`);
});

async function fixCloudflareSettings() {
  // Wait for server to be ready
  console.log('⏳ Waiting for server to start...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    console.log('\n🚀 Sending settings to API...');

    const response = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfSettings),
    });

    if (!response.ok) {
      throw new Error(`Failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Settings saved successfully!');

    console.log('\n📊 Verification:');
    console.log(`  Account ID: ${result.cfAccountId?.slice(0, 8)}...`);
    console.log(`  API Token: ${result.cfApiToken ? '✓ Set' : '✗ Missing'}`);
    console.log('\n✨ Cloudflare settings complete!');

    console.log('\n📋 What to do next:');
    console.log('  1. Go to: http://localhost:4321');
    console.log('  2. Navigate to: Ops Center → Deploy Management');
    console.log('  3. Select a domain from dropdown');
    console.log('  4. Click on "Cloudflare Workers" card (should highlight)');
    console.log('  5. Click Deploy button (should be blue and clickable)');
    console.log('\n🎉 Deployment should work now!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n💡 The settings might already be set.');
    console.log('📋 Please check:');
    console.log('  1. Go to: http://localhost:4321');
    console.log('  2. If error still shows, manually add to Settings:');
    console.log('     Cloudflare Account ID: ef771cfd6197dedb36bb3cea22ecf4fc');
    console.log('     Cloudflare API Token: 8dTwYeTJF93WbhAyi2FzhUe8PV3rIEta5b8Pq5MQ');
  }
}

fixCloudflareSettings();
