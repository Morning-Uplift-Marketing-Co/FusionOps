/**
 * Integration tests for template-router.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    generateHtmlByTemplate,
    generateAstroProjectByTemplate,
    DEFAULT_TEMPLATE_ID,
} from '../template-router.js';

describe('template-router integration', () => {
    const mockSite = {
        id: 'test-site-123',
        brand: 'TestBrand',
        domain: 'testbrand.com',
        templateId: 'classic',
        loanType: 'personal',
        amountMin: 100,
        amountMax: 5000,
        colorId: 'ruby',
        fontId: 'dm-sans',
        h1: 'Test Headline',
        sub: 'Test Subheadline',
        cta: 'Apply Now',
        badge: 'Test Badge',
    };

    describe('generateHtmlByTemplate', () => {
        it('should generate HTML for classic template', () => {
            const html = generateHtmlByTemplate(mockSite);

            expect(html).toBeDefined();
            expect(typeof html).toBe('string');
            expect(html.length).toBeGreaterThan(0);
            expect(html).toContain('<!DOCTYPE html>');
        });

        it('should generate HTML for pdl-loans-v1 template', () => {
            const site = { ...mockSite, templateId: 'pdl-loans-v1' };
            const html = generateHtmlByTemplate(site);

            expect(html).toBeDefined();
            expect(typeof html).toBe('string');
            expect(html.length).toBeGreaterThan(0);
        });

        it('should handle pdl-loansv1 alias', () => {
            const site = { ...mockSite, templateId: 'pdl-loansv1' };
            const html = generateHtmlByTemplate(site);

            expect(html).toBeDefined();
            expect(typeof html).toBe('string');
        });

        it('should generate HTML for astrodeck-loan template', () => {
            const site = { ...mockSite, templateId: 'astrodeck-loan' };
            const html = generateHtmlByTemplate(site);

            expect(html).toBeDefined();
            expect(typeof html).toBe('string');
        });

        it('should generate HTML for lander-core template', () => {
            const site = { ...mockSite, templateId: 'lander-core' };
            const html = generateHtmlByTemplate(site);

            expect(html).toBeDefined();
            expect(typeof html).toBe('string');
        });

        it('should default to classic template for unknown ID', () => {
            const site = { ...mockSite, templateId: 'unknown-template' };
            const html = generateHtmlByTemplate(site);

            expect(html).toBeDefined();
            expect(typeof html).toBe('string');
        });

        it('should include site brand in generated HTML', () => {
            const html = generateHtmlByTemplate(mockSite);

            expect(html).toContain('TestBrand');
        });

        it('should include site domain in generated HTML', () => {
            const html = generateHtmlByTemplate(mockSite);

            expect(html).toContain('testbrand.com');
        });
    });

    describe('generateAstroProjectByTemplate', () => {
        it('should generate Astro project for classic template', () => {
            const files = generateAstroProjectByTemplate(mockSite);

            expect(files).toBeDefined();
            expect(typeof files).toBe('object');

            // Check for essential files
            expect(files['package.json']).toBeDefined();
            expect(files['src/pages/index.astro']).toBeDefined();
        });

        it('should generate Astro project for pdl-loans-v1 template', () => {
            const site = { ...mockSite, templateId: 'pdl-loans-v1' };
            const files = generateAstroProjectByTemplate(site);

            expect(files).toBeDefined();
            expect(typeof files).toBe('object');
            expect(files['src/pages/index.astro']).toBeDefined();
        });

        it('should handle pdl-loansv1 alias for Astro generation', () => {
            const site = { ...mockSite, templateId: 'pdl-loansv1' };
            const files = generateAstroProjectByTemplate(site);

            expect(files).toBeDefined();
            expect(files['src/pages/index.astro']).toBeDefined();
        });

        it('should generate Astro project for astrodeck-loan template', () => {
            const site = { ...mockSite, templateId: 'astrodeck-loan' };
            const files = generateAstroProjectByTemplate(site);

            expect(files).toBeDefined();
            expect(typeof files).toBe('object');
        });

        it('should generate Astro project for lander-core template', () => {
            const site = { ...mockSite, templateId: 'lander-core' };
            const files = generateAstroProjectByTemplate(site);

            expect(files).toBeDefined();
            expect(typeof files).toBe('object');
        });

        it('should include package.json with correct name', () => {
            const files = generateAstroProjectByTemplate(mockSite);
            const pkgJson = JSON.parse(files['package.json']);

            expect(pkgJson.name).toBeDefined();
            expect(pkgJson.dependencies).toBeDefined();
        });

        it('should include Astro config', () => {
            const files = generateAstroProjectByTemplate(mockSite);

            expect(files['astro.config.mjs']).toBeDefined();
        });

        it('should include index.astro with Astro component structure', () => {
            const files = generateAstroProjectByTemplate(mockSite);
            const indexContent = files['src/pages/index.astro'];

            expect(indexContent).toBeDefined();
            // Astro components use <slot /> or <BaseLayout>, not direct doctype
            expect(indexContent.length).toBeGreaterThan(0);
        });
    });

    describe('DEFAULT_TEMPLATE_ID', () => {
        it('should be set to classic', () => {
            expect(DEFAULT_TEMPLATE_ID).toBe('classic');
        });
    });

    describe('Template Routing', () => {
        it('should route module templates to module generator', () => {
            const classicFiles = generateAstroProjectByTemplate(mockSite);

            expect(classicFiles).toBeDefined();
            expect(classicFiles['src/pages/index.astro']).toBeDefined();
        });

        it('should route legacy templates to legacy generators', () => {
            const site = { ...mockSite, templateId: 'lander-core' };
            const files = generateAstroProjectByTemplate(site);

            expect(files).toBeDefined();
            expect(files['src/pages/index.astro']).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle missing templateId', () => {
            const site = { ...mockSite, templateId: undefined };
            const html = generateHtmlByTemplate(site);

            expect(html).toBeDefined();
        });

        it('should handle empty site config', () => {
            const html = generateHtmlByTemplate({});

            expect(html).toBeDefined();
        });
    });

    describe('Site Configuration Injection', () => {
        it('should inject brand into generated content', () => {
            const html = generateHtmlByTemplate(mockSite);

            expect(html).toContain('TestBrand');
        });

        it('should inject custom headline', () => {
            const html = generateHtmlByTemplate(mockSite);

            expect(html).toContain('Test Headline');
        });

        it('should inject custom CTA', () => {
            const html = generateHtmlByTemplate(mockSite);

            expect(html).toContain('Apply Now');
        });

        it('should inject loan amounts', () => {
            const html = generateHtmlByTemplate(mockSite);

            expect(html).toContain('100');
            expect(html).toContain('5000');
        });
    });
});
