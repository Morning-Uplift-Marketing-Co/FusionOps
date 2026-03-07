import { generateDeployAssetsByTemplate } from '../utils/template-router.js';

const site = { id: 'ccbe3e', brand: 'scratchvetloans', domain: 'scratchvetloans.com', templateId: 'quickloan-pro', niche: 'pet-care', colorId: 'midnight-blue', amountMin: 100, amountMax: 5000 };
const r = await Promise.resolve(generateDeployAssetsByTemplate(site));
const html = typeof r === 'string' ? r : (r?.['/index.html'] || r?.['/'] || '');

// Find which script has hsl(var(
const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
for (const m of scriptMatches) {
  if (m[1].includes('hsl(var(')) {
    console.log('SCRIPT with hsl(var(:', m[1].slice(0, 300));
    console.log('---');
  }
}
