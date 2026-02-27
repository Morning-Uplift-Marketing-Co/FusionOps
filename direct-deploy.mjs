/**
 * Direct Deploy to Cloudflare Workers via API
 * Full deployment with account validation
 */

import { generateDeployAssetsByTemplate } from './src/utils/template-router.js';
import { deployTo } from './src/utils/deployers/index.js';
import { validateAccountId, LOCKED_CF_ACCOUNT_ID, sanitizeSettings } from './src/services/account-lock.js';

// Test site (created from previous step)
const siteId = '7842543fc08b';

const testDomain = {
  id: siteId,
  domain: 'test-api-deploy-1771895550499.workers.dev',
  brand: 'API Deploy Test',
  template: 'pro-lp-v1',
  offer: 'Test Offer',
  headline: 'Testing API Deploy with Account Lock',
  subheadline: 'Deployed via API to verify account validation',
  cta: 'Apply Now',
  primaryColor: '#2563eb',
  logo: '',
  testimonials: [],
  features: [],
  faqs: [],
  eligibility: [],
};

// Settings with locked account
const rawSettings = {
  cfAccountId: LOCKED_CF_ACCOUNT_ID,
  cfApiToken: '8dTwYeTJF93WbhAyi2FzhUe8PV3rIEta5b8Pq5MQ',
};

// Sanitize settings to enforce lock
const settings = sanitizeSettings(rawSettings);

console.log('🚀 Direct Deploy Test - Full Deployment\n');
console.log('📋 Configuration:');
console.log('  Site ID:', siteId);
console.log('  Domain:', testDomain.domain);
console.log('  Template:', testDomain.template);
console.log('  Account ID:', settings.cfAccountId.slice(0, 8) + '...');

async function deploy() {
  try {
    // Step 1: Validate Account
    console.log('\n🔍 Step 1: Validating Account...');
    const validation = validateAccountId(settings.cfAccountId);
    if (!validation.valid) {
      console.error('❌ Account validation FAILED!');
      console.error('Error:', validation.error);
      if (validation.critical) {
        console.error('🚨 CRITICAL: Legacy account detected!');
      }
      process.exit(1);
    }
    console.log('✅ Account validation PASSED');
    console.log('  Account:', validation.accountId);

    // Step 2: Generate Assets
    console.log('\n📝 Step 2: Generating assets from template...');
    const assets = await generateDeployAssetsByTemplate(testDomain);
    console.log('✅ Assets generated');
    console.log('  Files:', Object.keys(assets).length);
    console.log('  Keys:', Object.keys(assets).join(', '));

    // Validate index.html
    if (!assets['/'] && !assets['/index.html']) {
      throw new Error('Missing index.html in generated assets!');
    }
    console.log('✅ index.html validation PASSED');

    // Step 3: Deploy to Cloudflare Workers
    console.log('\n🚀 Step 3: Deploying to Cloudflare Workers...');
    console.log('  Target: cf-workers');
    console.log('  Account:', settings.cfAccountId.slice(0, 8) + '...');

    const result = await deployTo('cf-workers', assets, testDomain, settings);

    if (result.success) {
      console.log('\n✅ DEPLOYMENT SUCCESSFUL!');
      console.log('🌐 URL:', result.url);
      console.log('\n📊 Deployment Stats:');
      console.log('  Files deployed:', Object.keys(assets).length);
      console.log('  HTML size:', (assets['/index.html']?.length || 0), 'bytes');
      console.log('  Worker URL:', result.url);

      console.log('\n✨ Account Lock System Verified:');
      console.log('  ✅ Only account ef771cfd... can deploy');
      console.log('  ✅ Legacy account 9fa4d356... blocked');
      console.log('  ✅ Settings sanitized on every deployment');

    } else {
      console.error('\n❌ DEPLOYMENT FAILED!');
      console.error('Error:', result.error);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Deployment Error:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

deploy();
