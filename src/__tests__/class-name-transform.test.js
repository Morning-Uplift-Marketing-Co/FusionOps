/**
 * Class Name Transform Tests
 * ==========================
 * Test class name randomization in HTML, CSS, and JavaScript.
 */

import { describe, it, expect } from 'vitest';
import { load } from 'cheerio';
import { createClassNameMap, generateDeterministicString } from '../utils/fingerprint-seeder.js';

describe('Class Name Transformation', () => {
  it('should extract all class names from HTML', () => {
    const html = `
      <div class="hero container">
        <h1 class="title">Title</h1>
        <button class="btn btn-primary">Click me</button>
      </div>
    `;

    const $ = load(html);
    const classNames = new Set();
    $('[class]').each((i, el) => {
      const classes = $(el).attr('class');
      if (classes) {
        classes.split(/\s+/).forEach(c => classNames.add(c));
      }
    });

    expect(classNames.has('hero')).toBe(true);
    expect(classNames.has('container')).toBe(true);
    expect(classNames.has('title')).toBe(true);
    expect(classNames.has('btn')).toBe(true);
    expect(classNames.has('btn-primary')).toBe(true);
  });

  it('should preserve Tailwind utilities in class name mapping', () => {
    const siteId = 'tailwind-test';
    const classNames = [
      'container',
      'mx-auto',
      'hover:bg-blue-500',
      'md:flex',
      'dark:text-white',
      'focus:outline-none'
    ];

    const map = createClassNameMap(siteId, classNames);

    // Tailwind utilities should be preserved
    expect(map['hover:bg-blue-500']).toBe('hover:bg-blue-500');
    expect(map['md:flex']).toBe('md:flex');
    expect(map['dark:text-white']).toBe('dark:text-white');
    expect(map['focus:outline-none']).toBe('focus:outline-none');

    // Custom classes should be randomized
    expect(map['container']).not.toBe('container');
    expect(map['mx-auto']).not.toBe('mx-auto');
  });

  it('should create deterministic mapping for same siteId', () => {
    const siteId = 'deterministic-test';
    const classNames = ['hero', 'container', 'button', 'text-primary'];

    const map1 = createClassNameMap(siteId, classNames);
    const map2 = createClassNameMap(siteId, classNames);

    expect(map1).toEqual(map2);
  });

  it('should create different mappings for different siteIds', () => {
    const classNames = ['hero', 'container', 'button'];

    const map1 = createClassNameMap('site-001', classNames);
    const map2 = createClassNameMap('site-002', classNames);

    // At least some mappings should differ
    let hasDifference = false;
    for (const className of classNames) {
      if (map1[className] !== map2[className]) {
        hasDifference = true;
        break;
      }
    }
    expect(hasDifference).toBe(true);
  });

  it('should replace class names in HTML attributes', () => {
    const html = `
      <div class="hero container">
        <h1 class="title">Title</h1>
      </div>
    `;

    const $ = load(html);
    const classNames = new Set();
    $('[class]').each((i, el) => {
      const classes = $(el).attr('class');
      if (classes) {
        classes.split(/\s+/).forEach(c => classNames.add(c));
      }
    });

    const map = createClassNameMap('test-site', Array.from(classNames));

    // Apply transformation
    $('[class]').each((i, el) => {
      const classes = $(el).attr('class');
      if (classes) {
        const updated = classes
          .split(/\s+/)
          .map(c => map[c] || c)
          .join(' ');
        $(el).attr('class', updated);
      }
    });

    // Verify transformation
    const heroDiv = $('div').first();
    const classAttr = heroDiv.attr('class');
    expect(classAttr).not.toContain('hero');
    expect(classAttr).not.toContain('container');
    expect(classAttr).toBeTruthy();
  });

  it('should replace class names in CSS selectors', () => {
    const css = `
      .hero { background: blue; }
      .hero:hover { background: darkblue; }
      .container { max-width: 1200px; }
      .title { font-size: 2rem; }
    `;

    const classNames = ['hero', 'container', 'title'];
    const map = createClassNameMap('test-site', classNames);

    let transformedCss = css;
    for (const [original, randomized] of Object.entries(map)) {
      // Match .class-name at word boundary (including pseudo-classes)
      transformedCss = transformedCss.replace(
        new RegExp(`\\.${escapeRegex(original)}\\b`, 'g'),
        `.${randomized}`
      );
    }

    // Verify original class names are gone
    expect(transformedCss).not.toContain('.hero');
    expect(transformedCss).not.toContain('.container');
    expect(transformedCss).not.toContain('.title');

    // Verify randomized names are present
    expect(transformedCss).toContain(`.${map.hero}`);
    expect(transformedCss).toContain(`.${map.container}`);

    // Verify pseudo-classes still work
    expect(transformedCss).toContain(`:hover`);
  });

  it('should replace class names in JavaScript references', () => {
    const script = `
      document.querySelector('.hero').addEventListener('click', () => {
        document.body.classList.add('container');
        element.className = 'title';
      });
    `;

    const classNames = ['hero', 'container', 'title'];
    const map = createClassNameMap('test-site', classNames);

    let transformedScript = script;
    for (const [original, randomized] of Object.entries(map)) {
      // Match '.class' / ".class" (e.g. querySelector('.hero'))
      transformedScript = transformedScript.replace(
        new RegExp(`(['"])\\.${escapeRegex(original)}\\1`, 'g'),
        `$1.${randomized}$1`
      );
      // Match "classname" or 'classname' in JS (e.g. classList.add('container'))
      transformedScript = transformedScript.replace(
        new RegExp(`["']${escapeRegex(original)}["']`, 'g'),
        `"${randomized}"`
      );
    }

    // Verify original class names are gone
    expect(transformedScript).not.toContain("'.hero'");
    expect(transformedScript).not.toContain("'container'");
    expect(transformedScript).not.toContain("'title'");

    // Verify randomized names are present (hero uses '.class' form; others may use double quotes)
    expect(transformedScript).toContain(`.${map.hero}`);
    expect(transformedScript).toContain(`"${map.container}"`);
  });

  it('should avoid collisions in large class name lists', () => {
    const siteId = 'collision-test';
    const classNames = Array.from({ length: 100 }, (_, i) => `class-${i}`);

    const map = createClassNameMap(siteId, classNames);

    // Check for collisions
    const randomizedNames = new Set();
    for (const className of classNames) {
      const randomized = map[className];
      expect(randomizedNames.has(randomized)).toBe(false);
      randomizedNames.add(randomized);
    }

    expect(randomizedNames.size).toBe(classNames.length);
  });

  it('should handle class names with special characters', () => {
    const siteId = 'special-test';
    const classNames = ['btn-primary', 'text_large', 'col--1', 'is-active'];

    const map = createClassNameMap(siteId, classNames);

    // All should be mapped
    for (const className of classNames) {
      expect(map[className]).toBeTruthy();
      expect(map[className]).not.toBe(className);
    }
  });

  it('should handle mixed Tailwind and custom classes', () => {
    const siteId = 'mixed-test';
    const classNames = [
      'flex',
      'items-center',
      'justify-between',
      'my-4',
      'md:my-6',
      'lg:my-8',
      'custom-header',
      'header-title',
      'hover:bg-gray-100'
    ];

    const map = createClassNameMap(siteId, classNames);

    // Tailwind utilities preserved
    expect(map['flex']).not.toBe('flex'); // flex itself is custom (not a utility)
    expect(map['md:my-6']).toBe('md:my-6');
    expect(map['hover:bg-gray-100']).toBe('hover:bg-gray-100');

    // Custom classes randomized
    expect(map['custom-header']).not.toBe('custom-header');
    expect(map['header-title']).not.toBe('header-title');
  });

  it('should maintain mapping consistency across multiple transforms', () => {
    const siteId = 'consistency-test';
    const classNames = ['hero', 'container', 'button'];
    const map = createClassNameMap(siteId, classNames);

    // Apply same mapping multiple times
    const html = '<div class="hero container"><button class="button">Click</button></div>';
    const $ = load(html);

    for (let i = 0; i < 5; i++) {
      $('[class]').each((j, el) => {
        const classes = $(el).attr('class');
        if (classes) {
          const updated = classes
            .split(/\s+/)
            .map(c => map[c] || c)
            .join(' ');
          $(el).attr('class', updated);
        }
      });
    }

    // Verify final state
    const finalHtml = $.html();
    expect(finalHtml).not.toContain('class="hero');
    expect(finalHtml).not.toContain('class="container');
  });
});

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
