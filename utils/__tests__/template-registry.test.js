/**
 * Unit tests for template-registry.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    getAllTemplates,
    getTemplateById,
    hasTemplate,
    getTemplateGenerator,
    resolveTemplateId,
} from '../template-registry.js';

// Mock the module templates
vi.mock('../../../packages/lp-template-generator/src/core/template-registry.js', () => ({
    getTemplates: () => [
        { id: 'classic', name: 'Classic LP', description: 'Classic template', category: 'general', badge: 'Stable' },
        { id: 'pdl-loans-v1', name: 'PDL Loans V1', description: 'PDL template', category: 'pdl', badge: 'Popular' },
    ],
    getTemplate: (id) => {
        const templates = {
            'classic': { id: 'classic', name: 'Classic LP', description: 'Classic template', category: 'general', badge: 'Stable' },
            'pdl-loans-v1': { id: 'pdl-loans-v1', name: 'PDL Loans V1', description: 'PDL template', category: 'pdl', badge: 'Popular' },
        };
        return templates[id] || null;
    },
}));

describe('template-registry', () => {
    describe('getAllTemplates', () => {
        it('should return all templates (module + legacy)', () => {
            const templates = getAllTemplates();

            expect(templates).toBeInstanceOf(Array);
            expect(templates.length).toBeGreaterThan(0);

            // Check module templates are included
            const classic = templates.find(t => t.id === 'classic');
            expect(classic).toBeDefined();
            expect(classic.source).toBe('module');

            // Check legacy templates are included
            const astrodeck = templates.find(t => t.id === 'astrodeck-loan');
            expect(astrodeck).toBeDefined();
            expect(astrodeck.source).toBe('legacy');
        });

        it('should include badge for templates', () => {
            const templates = getAllTemplates();

            templates.forEach(t => {
                // Classic should have badge
                if (t.id === 'classic') {
                    expect(t.badge).toBe('Stable');
                }
            });
        });
    });

    describe('getTemplateById', () => {
        it('should return template by ID', () => {
            const template = getTemplateById('classic');

            expect(template).toBeDefined();
            expect(template.id).toBe('classic');
            expect(template.name).toBe('Classic LP');
        });

        it('should resolve aliases', () => {
            const template = getTemplateById('pdl-loansv1');

            expect(template).toBeDefined();
            expect(template.id).toBe('pdl-loans-v1');
        });

        it('should return null for unknown template', () => {
            const template = getTemplateById('unknown-template');
            expect(template).toBeNull();
        });

        it('should return legacy templates', () => {
            const template = getTemplateById('lander-core');

            expect(template).toBeDefined();
            expect(template.id).toBe('lander-core');
            expect(template.source).toBe('legacy');
        });
    });

    describe('hasTemplate', () => {
        it('should return true for existing templates', () => {
            expect(hasTemplate('classic')).toBe(true);
            expect(hasTemplate('pdl-loans-v1')).toBe(true);
            expect(hasTemplate('astrodeck-loan')).toBe(true);
            expect(hasTemplate('lander-core')).toBe(true);
        });

        it('should return true for aliased templates', () => {
            expect(hasTemplate('pdl-loansv1')).toBe(true);
        });

        it('should return false for unknown templates', () => {
            expect(hasTemplate('unknown-template')).toBe(false);
        });
    });

    describe('resolveTemplateId', () => {
        it('should return same ID for non-aliased templates', () => {
            expect(resolveTemplateId('classic')).toBe('classic');
            expect(resolveTemplateId('lander-core')).toBe('lander-core');
        });

        it('should resolve aliases to canonical IDs', () => {
            expect(resolveTemplateId('pdl-loansv1')).toBe('pdl-loans-v1');
        });

        it('should handle undefined input', () => {
            expect(resolveTemplateId(undefined)).toBeUndefined();
        });
    });

    describe('getTemplateGenerator', () => {
        it('should return module type for module templates', () => {
            const info = getTemplateGenerator('classic', 'astro');

            expect(info).toBeDefined();
            expect(info.type).toBe('module');
            expect(info.id).toBe('classic');
        });

        it('should return legacy type for legacy templates', () => {
            const info = getTemplateGenerator('lander-core', 'astro');

            expect(info).toBeDefined();
            expect(info.type).toBe('legacy');
            expect(info.generator).toBeDefined();
            expect(typeof info.generator).toBe('function');
        });

        it('should return null for unknown templates', () => {
            const info = getTemplateGenerator('unknown-template', 'astro');
            expect(info).toBeNull();
        });

        it('should support different generator types', () => {
            const astroInfo = getTemplateGenerator('lander-core', 'astro');
            const htmlInfo = getTemplateGenerator('lander-core', 'html');

            expect(astroInfo.generator).toBeDefined();
            expect(htmlInfo.generator).toBeDefined();
            // Both should be different functions
            expect(astroInfo.generator).not.toBe(htmlInfo.generator);
        });
    });

    describe('Template Aliases', () => {
        it('should maintain backward compatibility for old IDs', () => {
            // Old ID should resolve to new template
            const template = getTemplateById('pdl-loansv1');
            expect(template).toBeDefined();
            expect(template.id).toBe('pdl-loans-v1');

            // Generator should also work with old ID
            const generator = getTemplateGenerator('pdl-loansv1');
            expect(generator).toBeDefined();
        });
    });

    describe('Template Metadata', () => {
        it('should include all required metadata fields', () => {
            const templates = getAllTemplates();

            templates.forEach(t => {
                expect(t.id).toBeDefined();
                expect(t.name).toBeDefined();
                expect(t.description).toBeDefined();
                expect(t.source).toBeDefined();
                expect(['module', 'legacy']).toContain(t.source);
            });
        });
    });
});
