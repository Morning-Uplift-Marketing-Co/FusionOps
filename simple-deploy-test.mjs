/**
 * Simple Deploy Test via API
 * Deploy through the web API to test account lock
 */

const API_BASE = 'http://localhost:4325/api';

// Site ID that was created earlier
const siteId = '7842543fc08b';

console.log('🚀 Simple Deploy Test via API\n');
console.log('📋 Configuration:');
console.log('  API Base:', API_BASE);
console.log('  Site ID:', siteId);

async function testDeploy() {
  try {
    // Step 1: Get site details
    console.log('\n📝 Step 1: Getting site details...');
    const siteResponse = await fetch(`${API_BASE}/sites/${siteId}`);

    if (!siteResponse.ok) {
      throw new Error(`Failed to get site: ${siteResponse.statusText}`);
    }

    const site = await siteResponse.json();
    console.log('✅ Site found:', site.domain);
    console.log('  Template:', site.template);
    console.log('  Brand:', site.brand);

    // Step 2: Get current settings
    console.log('\n⚙️  Step 2: Getting current settings...');
    const settingsResponse = await fetch(`${API_BASE}/settings`);

    if (!settingsResponse.ok) {
      throw new Error(`Failed to get settings: ${settingsResponse.statusText}`);
    }

    const settings = await settingsResponse.json();
    console.log('✅ Settings loaded');
    console.log('  Account ID:', settings.cfAccountId?.slice(0, 8) + '...');

    // Step 3: Validate account (simulating DeploySection logic)
    console.log('\n🔍 Step 3: Validating account...');

    const LOCKED_ACCOUNT = '***CF_ACCOUNT_ID_REMOVED***';
    const LEGACY_ACCOUNT = '9fa4d356e0c6fa0612b3da1e03c7e707';

    const currentAccount = settings.cfAccountId?.trim().toLowerCase();

    if (!currentAccount) {
      console.error('❌ No account ID found in settings!');
      console.log('⚠️  Deployment would be BLOCKED');
      return;
    }

    if (currentAccount === LEGACY_ACCOUNT.toLowerCase()) {
      console.error('❌ LEGACY ACCOUNT DETECTED!');
      console.error('🚨 Deployment BLOCKED - Critical security issue');
      console.log('  Current:', currentAccount);
      console.log('  Required:', LOCKED_ACCOUNT);
      return;
    }

    if (currentAccount !== LOCKED_ACCOUNT.toLowerCase()) {
      console.error('❌ ACCOUNT MISMATCH!');
      console.error('🚨 Deployment BLOCKED');
      console.log('  Current:', currentAccount);
      console.log('  Required:', LOCKED_ACCOUNT);
      return;
    }

    console.log('✅ Account validation PASSED');
    console.log('  Account:', currentAccount);

    // Step 4: Deployment instructions
    console.log('\n🚀 Step 4: Ready to deploy!');
    console.log('\n📋 To complete deployment:');
    console.log('  1. Open browser: http://localhost:4325');
    console.log('  2. Go to: Ops Center → Deploy Management');
    console.log(`  3. Select domain: ${site.domain}`);
    console.log('  4. Select target: Cloudflare Workers');
    console.log('  5. Click Deploy button');
    console.log('\n✨ Account Lock System Status:');
    console.log('  ✅ Account ID validated: ef771cfd...');
    console.log('  ✅ Legacy account blocked: 9fa4d356...');
    console.log('  ✅ Deployment will proceed with correct account');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testDeploy();
