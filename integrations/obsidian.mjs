// integrations/obsidian.mjs
// Obsidian интеграция - запись прогнозов в markdown vault.

import { writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function yamlString(value) {
  const s = String(value == null ? '' : value);
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
}

function mdCell(value) {
  const s = String(value == null ? '' : value);
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ').replace(/\r/g, '');
}

function mdLinkText(value) {
  return String(value == null ? '' : value).replace(/\[\[/g, '[').replace(/\]\]/g, ']');
}

function atomicWrite(filePath, content) {
  const tmp = filePath + '.tmp.' + process.pid + '.' + Date.now();
  try {
    writeFileSync(tmp, content, 'utf-8');
    renameSync(tmp, filePath);
  } catch (e) {
    try { if (existsSync(tmp)) unlinkSync(tmp); } catch (_) { /* ignore */ }
    throw e;
  }
}

function normalizeSignals(signals) {
  if (!Array.isArray(signals)) return [];
  return signals.filter(s => s && typeof s === 'object');
}

function normalizeDrivers(drivers) {
  if (!Array.isArray(drivers)) return [];
  return drivers.filter(d => d && typeof d === 'object');
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.0';
  return (n * 100).toFixed(1);
}

function weightStr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '1.00';
  return n.toFixed(2);
}

class ObsidianVault {
  constructor({ vaultPath, folder = 'Crucix' } = {}) {
    this.vaultPath = vaultPath || process.env.OBSIDIAN_VAULT_PATH;
    this.folder = folder;
    this.enabled = !!this.vaultPath;
  }

  validate() {
    if (!this.enabled) return { ok: false, error: 'vault_not_configured' };
    try {
      mkdirSync(this.vaultPath, { recursive: true });
    } catch (e) {
      return { ok: false, error: 'vault_path_invalid: ' + e.message };
    }
    return { ok: true };
  }

  _folderPath(subfolder = '') {
    const path = subfolder
      ? join(this.vaultPath, this.folder, subfolder)
      : join(this.vaultPath, this.folder);
    if (!existsSync(path)) mkdirSync(path, { recursive: true });
    return path;
  }

  savePrediction(result, filename = null) {
    if (!this.enabled) return { ok: false, error: 'vault_not_configured' };
    if (!result || typeof result !== 'object') return { ok: false, error: 'invalid_result' };

    const cr = result.compositeRisk;
    if (!cr) return { ok: false, error: 'no_composite' };

    const ts = new Date(result.timestamp || Date.now());
    const dateStr = ts.toISOString().split('T')[0];
    const timeStr = ts.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
    const name = filename || (dateStr + '_' + timeStr + '_prediction');

    const frontmatter = this._buildFrontmatter({
      type: 'prediction',
      timestamp: ts.toISOString(),
      composite: cr.composite,
      level: cr.level,
      confidence: cr.confidence,
      signals: normalizeSignals(cr.signals).length,
      tags: ['crucix/prediction', 'crucix/level-' + (cr.level || 'unknown')],
    });

    const content = this._buildContent(result);
    const fullContent = '---\n' + frontmatter + '\n---\n\n' + content;

    const filePath = join(this._folderPath('predictions'), name + '.md');

    try {
      atomicWrite(filePath, fullContent);
    } catch (e) {
      return { ok: false, error: 'write_failed: ' + e.message };
    }

    return { ok: true, path: filePath };
  }

  saveDailyNote(date = new Date()) {
    if (!this.enabled) return { ok: false, error: 'vault_not_configured' };

    const dateStr = date.toISOString().split('T')[0];
    const filePath = join(this._folderPath('daily'), dateStr + '.md');
    const predictionLink = '[[' + dateStr + '_prediction]]';

    if (existsSync(filePath)) {
      let existing = '';
      try { existing = readFileSync(filePath, 'utf-8'); } catch (_) { existing = ''; }
      if (existing.includes(predictionLink)) {
        return { ok: true, path: filePath, existed: true, updated: false };
      }
      const patched = existing.replace(
        /(## Predictions\n)([\s\S]*?)(\n## Notes)/,
        (m, head, body, tail) => head + body + '\n- ' + predictionLink + '\n' + tail
      );
      try {
        atomicWrite(filePath, patched);
      } catch (e) {
        return { ok: false, error: 'write_failed: ' + e.message };
      }
      return { ok: true, path: filePath, existed: true, updated: true };
    }

    const frontmatter = this._buildFrontmatter({
      type: 'daily-note',
      date: dateStr,
      tags: ['crucix/daily'],
    });

    const content =
      '# Crucix Daily Note - ' + dateStr + '\n\n' +
      '## Predictions\n\n' +
      '- ' + predictionLink + '\n\n' +
      '## Notes\n\n';

    try {
      atomicWrite(filePath, '---\n' + frontmatter + '\n---\n\n' + content);
    } catch (e) {
      return { ok: false, error: 'write_failed: ' + e.message };
    }
    return { ok: true, path: filePath, existed: false };
  }

  saveSignalReference(signal) {
    if (!this.enabled) return { ok: false, error: 'vault_not_configured' };
    if (!signal || !signal.name) return { ok: false, error: 'invalid_signal' };

    const slug = String(signal.name).toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const filePath = join(this._folderPath('signals'), slug + '.md');

    const frontmatter = this._buildFrontmatter({
      type: 'signal',
      name: signal.name,
      category: signal.category || 'unknown',
      weight: signal.weight,
      tags: ['crucix/signal'],
    });

    const lines = [
      '# Signal: ' + mdLinkText(signal.name),
      '',
      '**Category:** ' + (signal.category || 'unknown'),
      '**Weight:** x' + weightStr(signal.weight),
      '',
    ];

    if (signal.rationale) {
      lines.push('## Rationale');
      lines.push('');
      lines.push(mdCell(signal.rationale));
      lines.push('');
    }

    lines.push('## Referenced by');
    lines.push('');
    lines.push('Search: `#crucix/prediction`');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('#crucix #signal');

    try {
      atomicWrite(filePath, '---\n' + frontmatter + '\n---\n\n' + lines.join('\n'));
    } catch (e) {
      return { ok: false, error: 'write_failed: ' + e.message };
    }
    return { ok: true, path: filePath };
  }

  updateIndex() {
    if (!this.enabled) return { ok: false, error: 'vault_not_configured' };

    const indexPath = join(this._folderPath(), 'README.md');
    const now = new Date().toISOString();

    let userBlock = '';
    if (existsSync(indexPath)) {
      try {
        const old = readFileSync(indexPath, 'utf-8');
        const m = old.match(/<!-- USER CONTENT -->([\s\S]*?)<!-- \/USER CONTENT -->/);
        if (m) userBlock = m[1];
      } catch (_) { /* ignore */ }
    }

    const content =
      '# Crucix Vault\n\n' +
      '> Auto-generated ' + now + '\n\n' +
      '## Structure\n\n' +
      '- **predictions/** - Individual predictions with full data\n' +
      '- **daily/** - Daily summary notes\n' +
      '- **signals/** - Signal reference\n\n' +
      '## Latest Predictions\n\n' +
      '<!-- Auto-updated by Crucix -->\n\n' +
      '## Tags\n\n' +
      '#crucix #prediction #alert\n\n' +
      '<!-- USER CONTENT -->' + userBlock + '<!-- /USER CONTENT -->\n';

    try {
      atomicWrite(indexPath, content);
    } catch (e) {
      return { ok: false, error: 'write_failed: ' + e.message };
    }
    return { ok: true, path: indexPath };
  }

  _buildFrontmatter(data) {
    const lines = ['---'];
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        lines.push(key + ':');
        for (const v of value) lines.push('  - ' + yamlString(v));
      } else if (typeof value === 'string') {
        lines.push(key + ': ' + yamlString(value));
      } else if (value === null || value === undefined) {
        lines.push(key + ': null');
      } else {
        lines.push(key + ': ' + value);
      }
    }
    lines.push('---');
    return lines.join('\n');
  }

  _buildContent(result) {
    const cr = result.compositeRisk || {};
    const lines = [];

    const levelLabel = ({
      low: '[LOW]',
      moderate: '[MOD]',
      elevated: '[ELEV]',
      high: '[HIGH]',
      critical: '[CRIT]',
    })[cr.level] || '[?]';

    lines.push('# ' + levelLabel + ' Crucix Prediction - ' + String(cr.level || 'unknown').toUpperCase());
    lines.push('');
    lines.push('**Composite Risk:** ' + (Number(cr.composite) ? Number(cr.composite).toFixed(3) : '0.000'));
    lines.push('**Confidence:** ' + mdCell(cr.confidence || 'unknown'));
    lines.push('**Signals:** ' + normalizeSignals(cr.signals).length);
    lines.push('');

    lines.push('## Top Drivers');
    lines.push('');
    for (const d of normalizeDrivers(cr.topDrivers).slice(0, 5)) {
      lines.push('- **' + mdLinkText(d.name) + '** - ' + pct(d.value) + '% (' + mdCell(d.rationale || '') + ')');
    }
    lines.push('');

    lines.push('## All Signals');
    lines.push('');
    lines.push('| Signal | Value | Weight | Rationale |');
    lines.push('|--------|-------|--------|-----------|');
    for (const s of normalizeSignals(cr.signals)) {
      lines.push('| ' + mdCell(s.name) + ' | ' + pct(s.value) + '% | x' + weightStr(s.weight) + ' | ' + mdCell(s.rationale || '') + ' |');
    }
    lines.push('');

    lines.push('## Related');
    lines.push('');
    const relDate = new Date(result.timestamp || Date.now()).toISOString().split('T')[0];
    lines.push('- [[daily/' + relDate + ']]');
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push('#crucix #prediction #level-' + (cr.level || 'unknown'));

    return lines.join('\n');
  }
}

export async function saveToObsidian(result, config) {
  const vault = new ObsidianVault(config || {});

  const check = vault.validate();
  if (!check.ok) {
    return { skipped: true, reason: check.error };
  }

  const results = {
    prediction: null,
    daily: null,
    index: null,
    signals: [],
    errors: [],
  };

  try {
    results.prediction = vault.savePrediction(result);
    if (!results.prediction.ok) results.errors.push({ step: 'prediction', error: results.prediction.error });
  } catch (e) {
    results.errors.push({ step: 'prediction', error: e.message });
  }

  try {
    results.daily = vault.saveDailyNote();
    if (!results.daily.ok) results.errors.push({ step: 'daily', error: results.daily.error });
  } catch (e) {
    results.errors.push({ step: 'daily', error: e.message });
  }

  try {
    results.index = vault.updateIndex();
    if (!results.index.ok) results.errors.push({ step: 'index', error: results.index.error });
  } catch (e) {
    results.errors.push({ step: 'index', error: e.message });
  }

  const signals = normalizeSignals(result && result.compositeRisk && result.compositeRisk.signals);
  for (const s of signals) {
    try {
      const r = vault.saveSignalReference(s);
      if (r.ok) results.signals.push(r.path);
      else results.errors.push({ step: 'signal:' + (s.name || '?'), error: r.error });
    } catch (e) {
      results.errors.push({ step: 'signal:' + (s.name || '?'), error: e.message });
    }
  }

  return {
    ok: results.errors.length === 0,
    results,
  };
}

export const OBSIDIAN_INFO = {
  name: 'Obsidian',
  description: 'Save predictions as markdown notes in Obsidian vault',
  envVars: ['OBSIDIAN_VAULT_PATH'],
  optional: true,
};

export { ObsidianVault };
