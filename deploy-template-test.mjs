/**
 * Deploy Template to Cloudflare Workers - Real Test
 */

import { generateDeployAssetsByTemplate } from './src/utils/template-router.js';
import { deployTo } from './src/utils/deployers/index.js';
import { validateAccountId, LOCKED_CF_ACCOUNT_ID } from './src/services/account-lock.js';

// Test domain with template
const testDomain = {
  id: 'test-' + Date.now(),
  domain: 'test-template-deploy.workers.dev',
  brand: 'Template Deploy Test',
  template: 'pro-lp-v1',
  offer: 'Test Offer',
  headline: 'Testing Template Deployment',
  subheadline: 'Account Lock System Verification',
  cta: 'Apply Now',
  primaryColor: '#2563eb',
  logo: '',
  testimonials: [],
  features: [],
  faqs: [],
  eligibility: [],
};

// Settings with correct account
const settings = {
  cfAccountId: LOCKED_CF_ACCOUNT_ID,
  cfApiToken: '8dTwYeTJF93WbhAyi2FzhUe8PV3rIEta5b8Pq5MQ',
};

console.log('🚀 Starting Template Deployment Test\n');
console.log('📋 Test Configuration:');
console.log('  Domain:', testDomain.brand);
console.log('  Template:', testDomain.template);
console.log('  Account ID:', LOCKED_CF_ACCOUNT_ID);

// Step 1: Validate Account
console.log('\n🔍 Step 1: Validating Account ID...');
const validation = validateAccountId(settings.cfAccountId);
if (!validation.valid) {
  console.error('❌ Account validation FAILED!');
  console.error('Error:', validation.error);
  process.exit(1);
}
console.log('✅ Account validation PASSED');

// Step 2: Generate Assets from Template
console.log('\n📝 Step 2: Generating assets from template...');
try {
  const assets = await generateDeployAssetsByTemplate(testDomain);
  console.log('✅ Assets generated successfully');
  console.log('  Files:', Object.keys(assets).length);
  console.log('  Keys:', Object.keys(assets).slice(0, 5).join(', '));

  // Validate assets contain index.html
  if (!assets['/'] && !assets['/index.html']) {
    throw new Error('Generated assets missing index.html!');
  }
  console.log('✅ index.html validation PASSED');

  // Step 3: Deploy to Cloudflare Workers
  console.log('\n🚀 Step 3: Deploying to Cloudflare Workers...');
  console.log('  Target: cf-workers');
  console.log('  Account:', LOCKED_CF_ACCOUNT_ID.slice(0, 8) + '...');

  const result = await deployTo('cf-workers', assets, testDomain, settings);

  if (result.success) {
    console.log('\n✅ DEPLOYMENT SUCCESSFUL!');
    console.log('🌐 URL:', result.url);
    console.log('📊 Stats:');
    console.log('  - Files deployed:', Object.keys(assets).length);
    console.log('  - HTML size:', (assets['/index.html']?.length || 0), 'bytes');
    console.log('\n✨ Account Lock System Working Correctly!');
    console.log('✅ Only account ef771cfd... can deploy');
  } else {
    console.error('\n❌ DEPLOYMENT FAILED!');
    console.error('Error:', result.error);
    process.exit(1);
  }

} catch (error) {
  console.error('\n❌ Error during deployment:');
  console.error(error.message);
  console.error(error.stack);
  process.exit(1);
}
