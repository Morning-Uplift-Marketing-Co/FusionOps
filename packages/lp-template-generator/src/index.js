/**
 * LP Template Generator
 * Main entry point for template generation
 */

// Import templates to register them
import './templates/index.js';

// Export core API
export * from './core/generator.js';
export * from './core/schema.js';
export * from './core/template-registry.js';
