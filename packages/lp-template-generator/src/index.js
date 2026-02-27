/**
 * LP Template Generator v2
 * ========================
 * Stable Astro landing page generator.
 * 
 * Usage:
 *   import { generate, listTemplates } from '@lp-factory/template-generator';
 *   const result = generate('installment-loans', { brand: 'CashBear', amountMax: 5000 });
 *   // result.ok === true
 *   // result.files === { 'package.json': '...', 'src/pages/index.astro': '...', ... }
 */

// Register all templates
import './templates/index.js';

// Export API
export { generate, listTemplates, normalizeConfig, resolveTokens } from './core/generator.js';
