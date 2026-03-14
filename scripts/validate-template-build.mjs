#!/usr/bin/env node
/**
 * Validate template can build successfully before importing to database
 * Usage: node scripts/validate-template-build.mjs <template-folder-path>
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const templatePath = process.argv[2];

if (!templatePath) {
  console.error('❌ Usage: node scripts/validate-template-build.mjs <template-folder-path>');
  process.exit(1);
}

const absPath = resolve(templatePath);

if (!existsSync(absPath)) {
  console.error(`❌ Template folder not found: ${absPath}`);
  process.exit(1);
}

console.log('🔍 Validating template:', absPath);
console.log('');

// 1. Check required files
console.log('📋 Checking required files...');
const requiredFiles = [
  'package.json',
  'astro.config.mjs',
  'tsconfig.json',
  'src/pages/index.astro'
];

const missingFiles = [];
for (const file of requiredFiles) {
  const filePath = join(absPath, file);
  if (!existsSync(filePath)) {
    missingFiles.push(file);
    console.log(`   ❌ Missing: ${file}`);
  } else {
    console.log(`   ✅ Found: ${file}`);
  }
}

if (missingFiles.length > 0) {
  console.error('\n❌ Template validation failed: Missing required files');
  process.exit(1);
}

// 2. Check package.json has required dependencies
console.log('\n📦 Checking dependencies...');
const packageJson = JSON.parse(readFileSync(join(absPath, 'package.json'), 'utf8'));
const requiredDeps = ['astro'];
const missingDeps = [];

for (const dep of requiredDeps) {
  if (!packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]) {
    missingDeps.push(dep);
    console.log(`   ❌ Missing: ${dep}`);
  } else {
    console.log(`   ✅ Found: ${dep}`);
  }
}

if (missingDeps.length > 0) {
  console.error('\n❌ Template validation failed: Missing required dependencies');
  process.exit(1);
}

// 3. Check for common syntax issues in index.astro
console.log('\n🔍 Checking index.astro syntax...');
const indexPath = join(absPath, 'src/pages/index.astro');
const indexContent = readFileSync(indexPath, 'utf8');

const syntaxIssues = [];

// Check for incomplete JSX
if (indexContent.includes('< ') || indexContent.includes(' >')) {
  syntaxIssues.push('Possible incomplete JSX tags');
}

// Check for missing semicolons in frontmatter
const frontmatterMatch = indexContent.match(/^---\n([\s\S]*?)\n---/);
if (frontmatterMatch) {
  const frontmatter = frontmatterMatch[1];
  const lines = frontmatter.split('\n').filter(l => l.trim() && !l.trim().startsWith('//'));
  
  for (const line of lines) {
    // Check if line looks like a statement but missing semicolon
    if (line.match(/^(const|let|var|import)\s+/) && !line.trim().endsWith(';') && !line.includes('{')) {
      syntaxIssues.push(`Missing semicolon: ${line.substring(0, 50)}...`);
    }
  }
}

if (syntaxIssues.length > 0) {
  console.log('   ⚠️  Potential syntax issues found:');
  syntaxIssues.forEach(issue => console.log(`      - ${issue}`));
} else {
  console.log('   ✅ No obvious syntax issues');
}

// 4. Install dependencies
console.log('\n📥 Installing dependencies...');
try {
  execSync('npm install', { 
    cwd: absPath, 
    stdio: 'inherit',
    timeout: 120000 // 2 minutes
  });
  console.log('   ✅ Dependencies installed');
} catch (error) {
  console.error('   ❌ Failed to install dependencies');
  process.exit(1);
}

// 5. Try to build
console.log('\n🔨 Testing build...');
try {
  // Create minimal .env for build test
  const envPath = join(absPath, '.env');
  if (!existsSync(envPath)) {
    const minimalEnv = `
PUBLIC_BRAND="Test Brand"
PUBLIC_DOMAIN="example.com"
PUBLIC_H1="Test Headline"
PUBLIC_SUB="Test Subheadline"
PUBLIC_CTA="Apply Now"
PUBLIC_PHONE="1-800-TEST"
PUBLIC_EMAIL="test@example.com"
PUBLIC_ADDRESS="Test Address"
PUBLIC_AID="12345"
PUBLIC_AMOUNTMIN="100"
PUBLIC_AMOUNTMAX="5000"
PUBLIC_PRIMARYCOLOR="#3b5bdb"
PUBLIC_ACCENTCOLOR="#f97316"
PUBLIC_APRMIN="5.99"
PUBLIC_APRMAX="35.99"
PUBLIC_CONVERSIONID=""
PUBLIC_FORMSTARTLABEL=""
PUBLIC_FORMSUBMITLABEL=""
PUBLIC_VOLUUMID=""
PUBLIC_VOLUUMDOMAIN=""
PUBLIC_VOLUUM_CLICK_URL=""
PUBLIC_COLORID=""
PUBLIC_FONTID=""
PUBLIC_LAYOUT=""
PUBLIC_RADIUS=""
PUBLIC_TRUSTBADGES=""
PUBLIC_REVIEWS="[]"
`.trim();
    writeFileSync(envPath, minimalEnv);
    console.log('   📝 Created test .env file');
  }

  execSync('npm run build', { 
    cwd: absPath, 
    stdio: 'inherit',
    timeout: 180000 // 3 minutes
  });
  console.log('   ✅ Build successful!');
} catch (error) {
  console.error('\n❌ Build failed!');
  console.error('   This template cannot be deployed until build issues are fixed.');
  process.exit(1);
}

console.log('\n✅ Template validation passed!');
console.log('   This template is ready to import to database.');
process.exit(0);
