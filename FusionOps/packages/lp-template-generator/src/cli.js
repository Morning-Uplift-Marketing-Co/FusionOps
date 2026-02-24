#!/usr/bin/env node
/**
 * LP Template Generator CLI
 * Command-line tool for generating landing page templates
 */

import { generateTemplate, getTemplates } from './index.js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function error(msg) {
  log(`ERROR: ${msg}`, 'red');
}

function success(msg) {
  log(`✓ ${msg}`, 'green');
}

function info(msg) {
  log(`ℹ ${msg}`, 'cyan');
}

function title(msg) {
  log(msg, 'magenta');
}

// Parse CLI args
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    template: null,
    config: null,
    output: null,
    list: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--template':
      case '-t':
        result.template = args[++i];
        break;
      case '--config':
      case '-c':
        result.config = args[++i];
        break;
      case '--output':
      case '-o':
        result.output = args[++i];
        break;
      case '--list':
      case '-l':
        result.list = true;
        break;
      case '--help':
      case '-h':
        result.help = true;
        break;
      default:
        if (arg.startsWith('-')) {
          error(`Unknown option: ${arg}`);
          result.help = true;
        }
    }
  }

  return result;
}

// Show help
function showHelp() {
  title('\nLP Template Generator CLI\n');
  console.log('Usage: lp-gen [options]\n');
  console.log('Options:');
  console.log('  -t, --template <id>    Template to use (classic, pdl-loans-v1)');
  console.log('  -c, --config <json>   Site config as JSON string or file path');
  console.log('  -o, --output <dir>    Output directory (default: ./dist)');
  console.log('  -l, --list            List available templates');
  console.log('  -h, --help           Show this help\n');
  console.log('Examples:');
  console.log('  lp-gen --list');
  console.log('  lp-gen --template classic --config \'{"brand":"MyLP"}\'');
  console.log('  lp-gen -t pdl-loans-v1 -c config.json -o ./output\n');
}

// List templates
function listTemplates() {
  title('\nAvailable Templates:\n');
  const templates = getTemplates();
  templates.forEach(t => {
    const badge = t.badge ? ` [${t.badge}]` : '';
    console.log(`  ${colors.cyan}${t.id.padEnd(15)}${colors.reset} ${t.name}${badge}`);
    console.log(`  ${' '.repeat(17)}${colors.gray}${t.description}${colors.reset}\n`);
  });
}

// Parse config (JSON string or file path)
function parseConfig(configStr) {
  if (!configStr) return {};

  // Try to read as file first
  try {
    const { readFileSync } = await import('fs');
    if (configStr.endsWith('.json')) {
      const content = readFileSync(configStr, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // Not a file or file doesn't exist, continue to parse as JSON
  }

  // Parse as JSON string
  try {
    return JSON.parse(configStr);
  } catch (e) {
    error(`Invalid JSON config: ${configStr}`);
    process.exit(1);
  }
}

// Write files to disk
function writeFiles(files, outputDir) {
  mkdirSync(outputDir, { recursive: true });

  let count = 0;
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(outputDir, path);
    const dir = dirname(fullPath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
    count++;
  }

  return count;
}

// Main
function main() {
  const opts = parseArgs();

  if (opts.help) {
    showHelp();
    return;
  }

  if (opts.list) {
    listTemplates();
    return;
  }

  if (!opts.template) {
    error('Template ID is required. Use --template or --list to see available templates.');
    showHelp();
    process.exit(1);
  }

  const config = parseConfig(opts.config);
  const outputDir = opts.output || './dist';

  title('\nGenerating Template...\n');
  info(`Template: ${opts.template}`);
  info(`Output: ${outputDir}`);

  try {
    const files = generateTemplate(opts.template, config);
    const count = writeFiles(files, outputDir);
    success(`Generated ${count} files to ${outputDir}\n`);
  } catch (e) {
    error(e.message);
    process.exit(1);
  }
}

main();
