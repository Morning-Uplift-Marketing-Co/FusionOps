/**
 * Test UI Deploy Flow
 * Simulate what happens when you click Deploy in UI
 */

import { generateDeployAssetsByTemplate } from './src/utils/template-router.js';
import { deployTo } from './src/utils/deployers/index.js';
import { validateAccountId, LOCKED_CF_ACCOUNT_ID } from './src/services/account-lock.js';

// Test site from database
const testSite = {
  id: 'e548f26a165e',
  domain: 'real-deploy-test-1771896274577.workers.dev',
  brand: 'Real Deploy Test',
  template: 'pro-lp-v1',
  offer: 'Test Personal Loan Offer',
  headline: 'Get Your Loan Approved in Minutes',
  subheadline: 'Fast, easy, and secure personal loans',
  cta: 'Apply Now',
  primaryColor: '#2563eb',
  logo: '',
};

// Settings (from environment + locked)
const settings = {
  cfAccountId: LOCKED_CF_ACCOUNT_ID,
  cfApiToken: '8dTwYeTJF93WbhAyi2FzhUe8PV3rIEta5b8Pq5MQ',
  neonUrl: 'postgresql://neondb_owner:npg_BbFD20JiQpYE@ep-old-hall-ai9n8868-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
};

console.log('🧪 Testing UI Deploy Flow\n');
console.log('📋 Configuration:');
console.log('  Site ID:', testSite.id);
console.log('  Template:', testSite.template);
console.log('  Account:', settings.cfAccountId.slice(0, 8) + '...');

async function testUiDeploy() {
  try {
    // Step 1: Validate Account (like DeploySection does)
    console.log('\n🔍 Step 1: Validating Account...');
    const validation = validateAccountId(settings.cfAccountId);
    if (!validation.valid) {
      console.error('❌ Account validation FAILED!');
      console.error('Error:', validation.error);
      process.exit(1);
    }
    console.log('✅ Account validation PASSED');

    // Step 2: Generate Assets (like buildHtmlForDomain)
    console.log('\n📝 Step 2: Generating assets from template...');
    const assets = await generateDeployAssetsByTemplate(testSite);
    console.log('✅ Assets generated');
    console.log('  Files:', Object.keys(assets).length);
    console.log('  Keys:', Object.keys(assets).join(', '));

    // Validate assets
    if (!assets['/'] && !assets['/index.html']) {
      throw new Error('Missing index.html!');
    }
    console.log('✅ index.html validation PASSED');

    // Step 3: Deploy (like DeploySection handleDeploy)
    console.log('\n🚀 Step 3: Deploying to Cloudflare Workers...');
    console.log('  Target: cf-workers');

    const result = await deployTo('cf-workers', assets, testSite, settings);

    if (result.success) {
      console.log('\n✅ DEPLOYMENT SUCCESSFUL!');
      console.log('🌐 URL:', result.url);
      console.log('\n📊 Stats:');
      console.log('  Files deployed:', Object.keys(assets).length);
      console.log('  HTML size:', (assets['/index.html']?.length || 0), 'bytes');
      console.log('\n✨ UI Deploy Flow Working!');
      console.log('✅ Template deployment successful');
    } else {
      console.error('\n❌ DEPLOYMENT FAILED!');
      console.error('Error:', result.error);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testUiDeploy();
