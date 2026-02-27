import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { fileURLToPath } from 'url';

/**
 * Astro Template Packager
 *
 * แปลงและบีบอัด Astro project เพื่อให้พร้อมใช้กับ Template Wizard
 *
 * การใช้งาน:
 *   node scripts/pack-template.mjs <template-folder> [template-id]
 *
 * ตัวอย่าง:
 *   node scripts/pack-template.mjs templates/pro-lp-v1 pro-lp-v1
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// รับ path จาก command line
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('Usage: node scripts/pack-template.mjs <template-folder> [template-id] [options]');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/pack-template.mjs templates/pro-lp-v1');
    console.log('  node scripts/pack-template.mjs templates/pro-lp-v1 pro-lp-v1 --name "Pro LP"');
    console.log('');
    console.log('Options:');
    console.log('  --name "Display Name"     Template display name');
    console.log('  --desc "Description"       Template description');
    console.log('  --category general|pdl   Template category');
    console.log('  --badge "Label"           Badge label');
    console.log('  --convert                Convert Astro props to template literals');
    process.exit(1);
}

const SOURCE_DIR = path.resolve(args[0]);
const TEMPLATE_ID = args[1] || path.basename(SOURCE_DIR).toLowerCase().replace(/\s+/g, '-');

// Parse options
let displayName = '';
let description = '';
let category = 'custom';
let badge = 'Custom';
let convertMode = false;

for (let i = 2; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) displayName = args[++i];
    if (args[i] === '--desc' && args[i + 1]) description = args[++i];
    if (args[i] === '--category' && args[i + 1]) category = args[++i];
    if (args[i] === '--badge' && args[i + 1]) badge = args[++i];
    if (args[i] === '--convert') convertMode = true;
}

const OUTPUT_FILE = path.join(__dirname, '..', `template-${TEMPLATE_ID}.zip`);

const EXCLUDE_DIRS = [
    'node_modules',
    '.git',
    '.astro',
    'dist',
    '.git',
    '.DS_Store'
];

const EXCLUDE_FILES = [
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '*.log'
];

const ALLOWED_EXTS = new Set([
    'astro', 'js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs',
    'json', 'css', 'html', 'md',
    'svg', 'ico', 'png', 'jpg', 'jpeg', 'webp',
    'woff', 'woff2', 'ttf', 'otf', 'eot'
]);

/**
 * แปลง Astro Props → Template Literals
 */
function convertAstroContent(content, filename) {
    if (!filename.endsWith('.astro')) return content;

    let result = content;

    // 1. ลบ frontmatter แต่เก็บ imports
    result = result.replace(/---[\s\S]*?---/g, (match) => {
        const lines = match.split('\n').slice(1, -1);
        const imports = lines.filter(line => {
            const trimmed = line.trim();
            return trimmed.startsWith('import') || trimmed.startsWith('export');
        });
        if (imports.length > 0) {
            return '---\n' + imports.join('\n') + '\n---';
        }
        return '';
    });

    // 2. แทนที่ Astro.props → site
    result = result.replace(/Astro\.props/g, 'site');

    // 3. แทนที่ {title}, {description}, {brand}, etc.
    const replacements = [
      { pattern: /\{title\}/g, replacement: '${site.title || "Your Title"}' },
      { pattern: /\{description\}/g, replacement: '${site.description || "Your description"}' },
      { pattern: /\{brand\}/g, replacement: '${site.brand || "YourBrand"}' },
      { pattern: /\{canonicalUrl\}/g, replacement: '${site.domain || "example.com"}' },
      { pattern: /ElasticCredits/g, replacement: '${site.brand || "YourBrand"}' },
      { pattern: /Elastic Credits/g, replacement: '${site.brand || "Your Brand"}' },
    ];

    for (const { pattern, replacement } of replacements) {
        result = result.replace(pattern, replacement);
    }

    return result;
}

/**
 * เช็คว่าควร skip ไฟล์หรือไม่
 */
function shouldSkip(filename, isDir) {
    if (isDir) {
        return EXCLUDE_DIRS.includes(filename);
    }
    for (const pattern of EXCLUDE_FILES) {
        if (filename.match(pattern.replace('*', '.*'))) return true;
    }
    return false;
}

/**
 * Scan และ pack ไฟล์
 */
async function pack() {
    if (!fs.existsSync(SOURCE_DIR)) {
        console.error(`❌ Error: Directory not found: ${SOURCE_DIR}`);
        process.exit(1);
    }

    console.log(`\n📦 Template Packager`);
    console.log(`   ID: ${TEMPLATE_ID}`);
    console.log(`   Source: ${SOURCE_DIR}`);
    if (displayName) console.log(`   Name: ${displayName}`);
    if (description) console.log(`   Desc: ${description}`);
    console.log(`   Mode: ${convertMode ? 'Convert Props → Literals' : 'Original'}\n`);

    const zip = new JSZip();
    let fileCount = 0;
    let skipCount = 0;

    function walk(dir, zipFolder, basePath = SOURCE_DIR) {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            const relPath = path.relative(basePath, fullPath).replace(/\\/g, '/');

            if (shouldSkip(file, stat.isDirectory())) {
                skipCount++;
                continue;
            }

            if (stat.isDirectory()) {
                const subFolder = zipFolder.folder(file);
                walk(fullPath, subFolder, basePath);
            } else {
                const ext = file.split('.').pop().toLowerCase();
                if (ALLOWED_EXTS.has(ext)) {
                    let content = fs.readFileSync(fullPath, 'utf-8');

                    // แปลง content ถ้าเปิด convert mode
                    if (convertMode) {
                        content = convertAstroContent(content, file);
                    }

                    zipFolder.file(file, content);
                    fileCount++;
                    console.log(`   + ${relPath}`);
                } else {
                    skipCount++;
                }
            }
        }
    }

    try {
        walk(SOURCE_DIR, zip);

        // เพิ่มไฟล์ metadata
        const metadata = {
            id: TEMPLATE_ID,
            name: displayName || TEMPLATE_ID.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            description: description || `Custom template: ${TEMPLATE_ID}`,
            category: category,
            badge: badge,
            filesCount: fileCount,
            packedAt: new Date().toISOString(),
            convertMode: convertMode
        };
        zip.file('.template.json', JSON.stringify(metadata, null, 2));

        console.log(`\n📦 Compressing ${fileCount} files... (${skipCount} skipped)`);
        const content = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 }
        });

        fs.writeFileSync(OUTPUT_FILE, content);

        console.log(`\n✅ Success!`);
        console.log(`   ZIP created: ${OUTPUT_FILE}`);
        console.log(`   Size: ${(content.length / 1024).toFixed(1)} KB\n`);
        console.log(`Next steps:`);
        console.log(`   1. Go to Template Wizard → Smart Import (ZIP)`);
        console.log(`   2. Upload: ${path.basename(OUTPUT_FILE)}`);
        console.log(`   3. Enter template info and save\n`);

    } catch (error) {
        console.error('❌ Failed to create zip:', error);
        process.exit(1);
    }
}

pack();
