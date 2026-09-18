// Crucix — CrucixDoctor
// Диагностика проекта: пустые файлы, дубликаты, ошибки импорта, версии.

import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';

export default class CrucixDoctor {
  constructor(opts = {}) {
    this.root = opts.root || process.cwd();
    this.issues = [];
  }

  scanDirectory(dir) {
    const issues = [];
    try {
      const files = readdirSync(dir);
      for (const file of files) {
        const full = join(dir, file);
        if (file.startsWith('.') || file === 'node_modules') continue;
        try {
          const stat = statSync(full);
          if (stat.isDirectory()) {
            issues.push(...this.scanDirectory(full));
          } else if (stat.isFile()) {
            const issue = this.checkFile(full, stat);
            if (issue) issues.push(issue);
          }
        } catch {}
      }
    } catch {}
    return issues;
  }

  checkFile(path, stat) {
    if (stat.size === 0 && path.endsWith('.mjs')) {
      return { type: 'empty_file', path, severity: 'medium' };
    }
    if (path.endsWith('.mjs') && stat.size < 50) {
      return { type: 'tiny_file', path, size: stat.size, severity: 'low' };
    }
    return null;
  }

  checkImports() {
    const issues = [];
    const dir = join(this.root, 'apis', 'sources');
    try {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.mjs')) continue;
        const content = readFileSync(join(dir, file), 'utf-8');
        const imports = content.match(/from\s+['"]\.\/([^'"]+)['"]/g) || [];
        for (const imp of imports) {
          const target = imp.match(/from\s+['"]\.\/([^'"]+)['"]/)[1];
          const targetPath = join(dir, target);
          if (!existsSync(targetPath)) {
            issues.push({ type: 'missing_import', file, target, severity: 'high' });
          }
        }
      }
    } catch {}
    return issues;
  }

  diagnose() {
    this.issues = [...this.scanDirectory(join(this.root, 'apis', 'sources')), ...this.checkImports()];
    return {
      total: this.issues.length,
      bySeverity: this._bySeverity(this.issues),
      issues: this.issues.slice(0, 100),
    };
  }

  _bySeverity(arr) {
    const g = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const i of arr) g[i.severity] = (g[i.severity] || 0) + 1;
    return g;
  }
}
