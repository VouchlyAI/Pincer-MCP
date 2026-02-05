#!/usr/bin/env node

/**
 * Sync version from package.json to other files
 * 
 * This script ensures version consistency across:
 * - server.json (2 locations)
 * - src/index.ts (VERSION constant)
 * - src/cli.ts (VERSION constant)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read version from package.json
const pkgPath = join(rootDir, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

console.log(`🔄 Syncing version ${version}...`);

let changeCount = 0;

// 1. Update server.json
const serverJsonPath = join(rootDir, 'server.json');
let serverJson = readFileSync(serverJsonPath, 'utf8');
const serverJsonBefore = serverJson;

// Replace both version occurrences
serverJson = serverJson.replace(/"version":\s*"[^"]+"/g, `"version": "${version}"`);

if (serverJson !== serverJsonBefore) {
    writeFileSync(serverJsonPath, serverJson, 'utf8');
    console.log('  ✓ Updated server.json');
    changeCount++;
}

// 2. Update src/index.ts
const indexPath = join(rootDir, 'src', 'index.ts');
let indexTs = readFileSync(indexPath, 'utf8');
const indexTsBefore = indexTs;

// Replace VERSION constant
indexTs = indexTs.replace(
    /const VERSION = "[^"]+";/,
    `const VERSION = "${version}";`
);

if (indexTs !== indexTsBefore) {
    writeFileSync(indexPath, indexTs, 'utf8');
    console.log('  ✓ Updated src/index.ts');
    changeCount++;
}

// 3. Update src/cli.ts
const cliPath = join(rootDir, 'src', 'cli.ts');
let cliTs = readFileSync(cliPath, 'utf8');
const cliTsBefore = cliTs;

// Replace VERSION constant
cliTs = cliTs.replace(
    /const VERSION = "[^"]+";/,
    `const VERSION = "${version}";`
);

if (cliTs !== cliTsBefore) {
    writeFileSync(cliPath, cliTs, 'utf8');
    console.log('  ✓ Updated src/cli.ts');
    changeCount++;
}

if (changeCount === 0) {
    console.log('  ℹ All files already in sync');
} else {
    console.log(`✅ Synced ${changeCount} file(s) to version ${version}`);
}
