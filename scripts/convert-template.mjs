#!/usr/bin/env node
/**
 * Template Converter
 *
 * แปลง Astro template ที่มีอยู่ให้รองรับระบบ
 * - แปลง Astro Props → Template Literals
 * - แปลง Hard-coded Brand → Dynamic Variables
 *
 * การใช้งาน:
 *   node scripts/convert-template.mjs templates/pro-lp-v1
 *
 * ตัวเลือก:
 *   --dry-run   แสดงผลแต่ไม่บันทึก
 *   --backup    สร้าง backup ก่อนแก้ไข
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// รับ path จาก command line
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('Usage: node scripts/convert-template.mjs <template-folder> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run    Show changes without saving');
    console.log('  --backup     Create backup before modifying');
    console.log('  --brand "X"  Set custom brand pattern to replace');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/convert-template.mjs templates/pro-lp-v1');
    console.log('  node scripts/convert-template.mjs templates/pro-lp-v1 --dry-run');
    console.log('  node scripts/convert-template.mjs templates/pro-lp-v1 --backup');
    process.exit(1);
}

const SOURCE_DIR = path.resolve(args[0]);
let dryRun = false;
let backupMode = false;
let customBrand = null;

for (let i = 1; i < args.length; i++) {
    if (args[i] === '--dry-run') dryRun = true;
    if (args[i] === '--backup') backupMode = true;
    if (args[i] === '--brand' && args[i + 1]) customBrand = args[++i];
}

if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`❌ Error: Directory not found: ${SOURCE_DIR}`);
    process.exit(1);
}

// Backup function
function createBackup(sourceDir) {
    const backupPath = sourceDir + '.backup';
    if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { recursive: true, force: true });
    }
    fs.cpSync(sourceDir, backupPath, { recursive: true });
    console.log(`📁 Backup created: ${backupPath}`);
    return backupPath;
}

// ค้นหาไฟล์ .astro ทั้งหมด
function findAstroFiles(dir, basePath = dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip โฟลเดอร์ที่ไม่ต้องการ
        if (entry.isDirectory()) {
            if (['node_modules', '.git', '.astro', 'dist', 'backup'].includes(entry.name)) {
                continue;
            }
            files.push(...findAstroFiles(fullPath, basePath));
            continue;
        }

        if (entry.name.endsWith('.astro')) {
            files.push(fullPath);
        }
    }

    return files;
}

// แปลง content
function convertFile(filePath, changes) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    const fileChanges = [];

    // Helper: แทนที่และบันทึก
    const replace = (pattern, replacement, desc) => {
        const newContent = content.replace(pattern, replacement);
        if (newContent !== content) {
            modified = true;
            fileChanges.push(desc);
            content = newContent;
            return true;
        }
        return false;
    };

    // 1. ลบ/แปลง Astro Props section
    content = content.replace(/---[\s\S]*?---/g, (match) => {
        const lines = match.split('\n').slice(1, -1); // ลบ --- บรรทัดแรก/ท้าย

        // เก็บ imports
        const imports = [];
        // เก็บ interface Props แต่แปลงเป็น comment
        const others = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('import') || trimmed.startsWith('export')) {
                imports.push(line);
            } else if (trimmed.startsWith('interface')) {
                others.push('// ' + trimmed);
            } else if (trimmed && !trimmed.startsWith('const') && !trimmed.startsWith('const {')) {
                others.push('// ' + trimmed);
            }
        }

        if (imports.length > 0 || others.length > 0) {
            fileChanges.push('Convert Astro Props to comment');
            return '---\n' + [...imports, ...others].join('\n') + '\n---';
        }
        return '';
    });

    // 2. แปลง Astro.props → site
    if (replace(/Astro\.props/g, 'site', 'Astro.props → site')) {
        changes.add('Astro.props → site');
    }

    // 3. แปลง {title}, {description}, {brand} → template literals
    const templateVarReplacements = [
        { pattern: /\{title\}/g, replacement: '${site.title || "Your Title"}', desc: '{title} → ${site.title}' },
        { pattern: /\{description\}/g, replacement: '${site.description || "Your description"}', desc: '{description} → ${site.description}' },
        { pattern: /\{brand\}/g, replacement: '${site.brand || "YourBrand"}', desc: '{brand} → ${site.brand}' },
        { pattern: /\{canonicalUrl\}/g, replacement: '${site.domain || "example.com"}', desc: '{canonicalUrl} → ${site.domain}' },
    ];

    for (const { pattern, replacement, desc } of templateVarReplacements) {
        if (replace(pattern, replacement, desc)) {
            changes.add(desc);
        }
    }

    // 4. แปลง Hard-coded Brand (ถ้าระบุ)
    const brandReplacements = [
        { pattern: /ElasticCredits/g, replacement: '${site.brand || "ElasticCredits"}', desc: 'ElasticCredits → ${site.brand}' },
        { pattern: /Elastic Credits/g, replacement: '${site.brand || "Elastic Credits"}', desc: 'Elastic Credits → ${site.brand}' },
        { pattern: /elastic-credits/g, replacement: '${(site.brand || "ElasticCredits").toLowerCase().replace(/\\s+/g, "-")}', desc: 'elastic-credits → ${site.brand.toLowerCase()}' },
    ];

    if (customBrand) {
        brandReplacements.unshift({
            pattern: new RegExp(customBrand.replace(/\s/g, '\\s'), 'g'),
            replacement: '${site.brand || "' + customBrand + '"}',
            desc: `${customBrand} → ${site.brand}`
        });
    }

    for (const { pattern, replacement, desc } of brandReplacements) {
        if (replace(pattern, replacement, desc)) {
            changes.add(desc);
        }
    }

    // 5. แปลง Props destructuring ที่เหลือ
    if (replace(/const\s*\{[^}]*\}\s*=\s*site/g, '// Props from site', 'Remove props destructuring')) {
        changes.add('Remove props destructuring');
    }

    // 6. แปลง {variable} ที่เป็น single brace
    const singleVarPattern = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    content = content.replace(singleVarPattern, (match, varName) => {
        // ถ้าเป็นตัวแปรที่รู้จัก ให้แปลง
        const knownVars = ['title', 'description', 'brand', 'canonicalUrl', 'domain', 'h1', 'sub', 'cta', 'badge'];
        if (knownVars.includes(varName)) {
            const changeDesc = '{' + varName + '} → ${site.' + varName + '}';
            changes.add(changeDesc);
            return '${site.' + varName + ` || "${varName}"}`;
        }
        return match;
    });

    return { content, modified, fileChanges };
}

// Main
async function main() {
    console.log(`\n🔧 Template Converter`);
    console.log(`   Source: ${SOURCE_DIR}`);
    console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will modify files)'}\n`);

    // Backup ถ้าต้องการ
    if (backupMode && !dryRun) {
        createBackup(SOURCE_DIR);
    }

    // ค้นหาไฟล์ .astro
    console.log('🔍 Scanning for .astro files...');
    const astroFiles = findAstroFiles(SOURCE_DIR);
    console.log(`   Found ${astroFiles.length} files\n`);

    const allChanges = new Set();
    let modifiedCount = 0;

    for (const filePath of astroFiles) {
        const relPath = path.relative(SOURCE_DIR, filePath);

        try {
            const { content, modified, fileChanges } = convertFile(filePath, allChanges);

            if (modified) {
                modifiedCount++;
                console.log(`\n📝 ${relPath}`);
                for (const change of fileChanges) {
                    console.log(`   - ${change}`);
                }

                if (!dryRun) {
                    fs.writeFileSync(filePath, content, 'utf-8');
                }
            }
        } catch (err) {
            console.error(`   ❌ Error processing ${relPath}: ${err.message}`);
        }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`📊 Summary:`);
    console.log(`   Files scanned: ${astroFiles.length}`);
    console.log(`   Files modified: ${modifiedCount}`);
    console.log(`   Total changes: ${allChanges.size}`);

    if (allChanges.size > 0) {
        console.log(`\n   Changes made:`);
        for (const change of allChanges) {
            console.log(`   - ${change}`);
        }
    }

    if (dryRun) {
        console.log(`\n⚠️  DRY RUN mode - no files were modified.`);
        console.log(`   Run without --dry-run to apply changes.\n`);
    } else {
        console.log(`\n✅ Conversion complete!\n`);
    }
}

main();
