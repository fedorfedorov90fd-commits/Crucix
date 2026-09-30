#!/usr/bin/env node

import { readdir, stat, readFile, writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = resolve(__dirname, '..');
const SOURCES_DIR = join(PROJECT_ROOT, 'apis', 'sources');
const SERVER_FILE = join(PROJECT_ROOT, 'server.mjs');
const REGISTRY_DIR = join(PROJECT_ROOT, 'registry');
const REGISTRY_FILE = join(REGISTRY_DIR, 'api-registry.json');
const REPORT_FILE = join(REGISTRY_DIR, 'api-registry-report.txt');

// Patterns to ignore (backup/copy files)
const IGNORE_PATTERNS = [
    /\(копия\)/,
    /\(другая копия\)/,
    /\(3-я копия\)/,
    /\(4-я копия\)/,
    /\(5-я копия\)/,
    /\(6-я копия\)/,
    /\(7-я копия\)/,
    /\(8-я копия\)/,
    /\(9-я копия\)/,
    /\(10-я копия\)/,
    /copy/i,
    /backup/i,
    /\.bak$/,
    /\.backup$/,
    /^=/,
    /^_/,
];

function shouldIgnore(filename) {
    for (const pattern of IGNORE_PATTERNS) {
        if (pattern.test(filename)) {
            return true;
        }
    }
    return false;
}

async function getRegisteredModules() {
    try {
        const content = await readFile(SERVER_FILE, 'utf-8');
        const imports = [];
        const regex = /const\s+mod_(\w+)\s*=\s*await\s+safeImport\(\s*['"]\.\/apis\/sources\/(\w+)['"]\s*\)/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            imports.push({
                variable: match[1],
                file: match[2],
                fullImport: match[0]
            });
        }
        return imports;
    } catch (error) {
        console.error('Error reading server.mjs:', error.message);
        return [];
    }
}

async function scanSources() {
    const modules = [];
    try {
        const files = await readdir(SOURCES_DIR);
        for (const file of files) {
            if (!file.endsWith('.mjs')) continue;
            if (shouldIgnore(file)) continue;

            const fullPath = join(SOURCES_DIR, file);
            const stats = await stat(fullPath);
            const name = file.replace('.mjs', '');
            modules.push({
                name: name,
                file: file,
                path: fullPath,
                size: stats.size,
                mtime: stats.mtime
            });
        }
    } catch (error) {
        console.error('Error scanning apis/sources/:', error.message);
    }
    return modules.sort((a, b) => a.name.localeCompare(b.name));
}

function analyzeRegistration(modules, registered) {
    const registeredNames = new Set(registered.map(r => r.file));
    const result = {
        total: modules.length,
        registered: [],
        unregistered: [],
        byStatus: { registered: 0, unregistered: 0 },
        details: []
    };

    for (const mod of modules) {
        const isRegistered = registeredNames.has(mod.name);
        const regInfo = registered.find(r => r.file === mod.name);
        const status = isRegistered ? 'registered' : 'unregistered';
        result.byStatus[status]++;
        result.details.push({
            name: mod.name,
            file: mod.file,
            size: mod.size,
            mtime: mod.mtime,
            registered: isRegistered,
            variable: regInfo ? regInfo.variable : null,
            status: status
        });
        if (isRegistered) {
            result.registered.push(mod.name);
        } else {
            result.unregistered.push(mod.name);
        }
    }

    return result;
}

function generateRegistryContent(analysis, registeredModules) {
    return {
        generated: new Date().toISOString(),
        projectRoot: PROJECT_ROOT,
        totalModules: analysis.total,
        registeredCount: analysis.byStatus.registered,
        unregisteredCount: analysis.byStatus.unregistered,
        registeredModules: analysis.registered,
        unregisteredModules: analysis.unregistered,
        modules: analysis.details,
        registeredImports: registeredModules
    };
}

function generateReport(analysis) {
    const lines = [];
    const now = new Date().toISOString();

    lines.push('='.repeat(70));
    lines.push('CRUCIX API REGISTRY');
    lines.push('Date: ' + now);
    lines.push('Project: ' + PROJECT_ROOT);
    lines.push('='.repeat(70));
    lines.push('');
    lines.push('TOTAL MODULES: ' + analysis.total);
    lines.push('REGISTERED: ' + analysis.byStatus.registered);
    lines.push('UNREGISTERED: ' + analysis.byStatus.unregistered);
    lines.push('');

    if (analysis.registered.length > 0) {
        lines.push('REGISTERED MODULES:');
        for (const name of analysis.registered) {
            lines.push('  ' + name);
        }
        lines.push('');
    }

    if (analysis.unregistered.length > 0) {
        lines.push('UNREGISTERED MODULES:');
        for (const name of analysis.unregistered) {
            lines.push('  ' + name);
        }
        lines.push('');
    }

    lines.push('='.repeat(70));
    lines.push('Registry saved: ' + REGISTRY_FILE);
    lines.push('='.repeat(70));

    return lines.join('\n');
}

async function main() {
    console.log('CRUCIX API Registry Generator (ignoring copies/backups)...');
    console.log('-'.repeat(50));

    await mkdir(REGISTRY_DIR, { recursive: true });

    console.log('Reading server.mjs...');
    const registeredModules = await getRegisteredModules();
    console.log('  Found registered imports: ' + registeredModules.length);

    console.log('Scanning apis/sources/ (ignoring copies and backups)...');
    const modules = await scanSources();
    console.log('  Found modules: ' + modules.length);

    console.log('Analyzing registration...');
    const analysis = analyzeRegistration(modules, registeredModules);
    console.log('  Registered: ' + analysis.byStatus.registered);
    console.log('  Unregistered: ' + analysis.byStatus.unregistered);

    const registryData = generateRegistryContent(analysis, registeredModules);
    await writeFile(REGISTRY_FILE, JSON.stringify(registryData, null, 2), 'utf-8');
    console.log('  Registry saved: ' + REGISTRY_FILE);

    const report = generateReport(analysis);
    await writeFile(REPORT_FILE, report, 'utf-8');
    console.log('  Report saved: ' + REPORT_FILE);

    console.log('-'.repeat(50));
    console.log('Done!');
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
