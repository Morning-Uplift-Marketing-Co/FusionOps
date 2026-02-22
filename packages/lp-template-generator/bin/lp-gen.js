#!/usr/bin/env node
/**
 * LP Template Generator CLI Entry Point
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Run CLI
import('./cli.js');
