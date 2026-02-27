#!/usr/bin/env node
/**
 * Template Packager Tool
 * แปลง Astro project เป็น template ที่พร้อมใช้กับระบบ
 *
 * การใช้งาน:
 *   node scripts/package-template.mjs templates/pro-lp-v1
 *
 * สิ่งที่ทำ:
 *   1. สแกนไฟล์ .astro และแปลง Astro Props → Template Literals
 *   2. สร้างไฟล์ .template.json
 *   3. สร้าง ZIP พร้อมอัปโหลด
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ค่าคงที่สำหรับ Template Literals
const SITE_VARS = [
  'brand', 'title', 'description', 'h1', 'h1span', 'sub', 'cta',
  'badge', 'domain', 'email', 'conversionId', 'formStartLabel',
  'formSubmitLabel', 'aid', 'voluumDomain', 'amountMin', 'amountMax',
  'aprMin', 'aprMax', 'loanLabel'
];

// Pattern แทนที่ Astro Props → Template Literals
const REPLACEMENTS = [
  // Astro.props → site
  { pattern: /Astro\.props/g, replacement: 'site' },
  // {title} → ${site.title}
  { pattern: /\{title\}/g, replacement: '${site.title}' },
  { pattern: /\{description\}/g, replacement: '${site.description}' },
  { pattern: /\{canonicalUrl\}/g, replacement: '${site.domain}' },
  // {brand} → ${site.brand}
  { pattern: /\{brand\}/g, replacement: '${site.brand}' },
  // Class ที่เป็น dynamic ของ Astro
  { pattern: /class:list\([^)]+\)/g, replacement: '' }, // ลบ class:list ไปก่อน
  // open={i === 0} → open="true" (default first item open)
  { pattern: /open=\{i === 0\}/g, replacement: 'open="true"' },
  { pattern: /open=\{i\s*===\s*0\}/g, replacement: 'open="true"' },
];

// Pattern สำหรับ hard-coded brand names
const BRAND_PATTERNS = [
  { pattern: /ElasticCredits/g, replacement: '${site.brand || "ElasticCredits"}' },
  { pattern: /Elastic Credits/g, replacement: '${site.brand || "Elastic Credits"}' },
  { pattern: /elastic-credits/g, replacement: '${(site.brand || "ElasticCredits").toLowerCase().replace(/\s+/g, "-")}' },
];

/**
 * อ่านไฟล์และแปลง content
 */
function processFile(filePath, templateId) {
  let content = readFileSync(filePath, 'utf-8');
  const ext = filePath.split('.').pop();

  // ประมวลผลเฉพาะ .astro หรือ .md
  if (ext === 'astro' || ext === 'md') {
    // 1. ลบ Astro Props section
    content = content.replace(/---[\s\S]*?---/g, (match) => {
      // ถ้ามี imports ด้านใน ให้เก็บไว้
      const lines = match.split('\n');
      const imports = lines.filter(line => line.trim().startsWith('import'));
      if (imports.length > 0) {
        return '---\n' + imports.join('\n') + '\n---';
      }
      return '';
    });

    // 2. แทนที่ Astro Props → Template Literals
    for (const repl of REPLACEMENTS) {
      content = content.replace(repl.pattern, repl.replacement);
    }

    // 3. แทนที่ Hard-coded Brand
    for (const repl of BRAND_PATTERNS) {
      content = content.replace(repl.pattern, repl.replacement);
    }

    // 4. แปลง {variable} → ${site.variable} สำหรับตัวแปรที่รู้จัก
    for (const v of SITE_VARS) {
      // ถ้ายังไม่มี site. prefix ให้เพิ่ม
      const regex = new RegExp(`\\{${v}\\}`, 'g');
      if (!content.includes(`site.${v}`)) {
        content = content.replace(regex, `\${site.${v} || "${getDefaultForVar(v)}"}`);
      }
    }
  }

  return content;
}

/**
 * ค่า default สำหรับแต่ละตัวแปร
 */
function getDefaultForVar(varName) {
  const defaults = {
    brand: 'YourBrand',
    title: 'Your Title',
    description: 'Your description',
    h1: 'Your Headline',
    h1span: 'Get Started',
    sub: 'Your subheadline here',
    cta: 'Get Started',
    badge: 'Featured',
    domain: 'example.com',
    email: 'support@example.com',
    conversionId: '',
    formStartLabel: '',
    formSubmitLabel: '',
    aid: '',
    voluumDomain: '',
    amountMin: 100,
    amountMax: 5000,
    aprMin: 5.99,
    aprMax: 35.99,
    loanLabel: 'Personal Loans'
  };
  return defaults[varName] || '';
}

/**
 * สแกนไฟล์ทั้งหมดในโฟลเดอร์
 */
function scanFiles(dir, baseDir) {
  const files = {};
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    // ข้ามโฟลเดอร์ที่ไม่ต้องการ
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', '.astro', '.git'].includes(entry.name)) {
        continue;
      }
      Object.assign(files, scanFiles(fullPath, baseDir));
      continue;
    }

    // เลือกเฉพาะไฟล์ที่ต้องการ
    const ext = entry.name.split('.').pop();
    const allowedExts = ['astro', 'js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs', 'json', 'css', 'html', 'md', 'svg', 'ico', 'png', 'jpg', 'webp', 'woff', 'woff2', 'ttf'];

    if (!allowedExts.includes(ext)) {
      continue;
    }

    // อ่านและประมวลผลไฟล์
    const relPath = relative(baseDir, fullPath).replace(/\\/g, '/');
    files[relPath] = processFile(fullPath);
  }

  return files;
}

/**
 * สร้างไฟล์ .template.json
 */
function createTemplateConfig(templateId, files) {
  const config = {
    id: templateId,
    name: templateId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    description: `Custom template: ${templateId}`,
    category: 'custom',
    badge: 'Custom',
    files: files,
    filesCount: Object.keys(files).length,
    createdAt: new Date().toISOString()
  };
  return JSON.stringify(config, null, 2);
}

/**
 * สร้าง output directory
 */
function ensureOutputDir() {
  const outDir = join(__dirname, '..', 'templates-output');
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  return outDir;
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node scripts/package-template.mjs <template-folder>');
    console.log('Example: node scripts/package-template.mjs templates/pro-lp-v1');
    process.exit(1);
  }

  const templatePath = args[0];
  const templateId = args[1] || templatePath.split(/[/\\]/).pop();

  console.log(`\n📦 Packaging Template: ${templateId}`);
  console.log(`   Source: ${templatePath}\n`);

  if (!existsSync(templatePath)) {
    console.error(`❌ Error: Directory not found: ${templatePath}`);
    process.exit(1);
  }

  // 1. Scan และประมวลผลไฟล์
  console.log('🔍 Scanning files...');
  const files = scanFiles(templatePath, templatePath);
  console.log(`   Found ${Object.keys(files).length} files\n`);

  // 2. สร้างไฟล์ config
  const config = createTemplateConfig(templateId, files);
  const outDir = ensureOutputDir();
  const configPath = join(outDir, `${templateId}.template.json`);
  writeFileSync(configPath, config, 'utf-8');
  console.log(`✅ Created: ${configPath}\n`);

  // 3. สรุปไฟล์ที่ได้
  console.log('📄 Files processed:');
  Object.keys(files).sort().forEach(f => {
    const size = JSON.stringify(files[f]).length;
    console.log(`   ${f} (${(size / 1024).toFixed(1)} KB)`);
  });

  console.log(`\n✨ Done! Template "${templateId}" is ready to upload.\n`);
  console.log(`Next steps:`);
  console.log(`   1. Go to Template Wizard → Upload ZIP`);
  console.log(`   2. Upload the ${templateId} folder as ZIP`);
  console.log(`   3. Or use the API directly with ${configPath}\n`);
}

main();
