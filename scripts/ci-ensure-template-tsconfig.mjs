#!/usr/bin/env node
/**
 * Run from deploy-lp.yml with cwd = template directory (after npm install).
 * Creates tsconfig.json only when missing, so esbuild does not use monorepo root tsconfig.
 */
import { ensureTemplateTsconfig, detectTemplateStack } from './lib/template-tsconfig-fallback.mjs';

const dir = process.cwd();
const stack = detectTemplateStack(dir);

if (!stack) {
  console.log('[ci-tsconfig] No astro/vite config found; skip tsconfig scaffold');
  process.exit(0);
}

const wrote = ensureTemplateTsconfig(dir, stack);
if (wrote) {
  console.log(`[ci-tsconfig] Wrote tsconfig.json (${stack}) — was missing`);
} else {
  console.log('[ci-tsconfig] tsconfig.json already present');
}
