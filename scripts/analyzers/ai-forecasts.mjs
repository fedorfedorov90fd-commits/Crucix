#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import AIForecasts from '../../apis/sources/ai-forecasts.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ANALYTICS = join(ROOT, 'data', 'analytics');
const OUT_DIR = join(ANALYTICS, 'forecast');
const OUT_FILE = join(OUT_DIR, 'ai-forecasts.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const aif = new AIForecasts();
  const risks = await readJson(join(ANALYTICS, 'specialist', 'strategic-risk-composite.json'), { data: { countries: {} } });
  const topRisk = Object.entries(risks.data?.countries || {})
    .filter(([k, v]) => typeof v.score === 'number')
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 5)
    .map(([code, r]) => ({ code, name: r.countryName, score: r.score }));
  const result = await aif.forecast({ topRiskCountries: topRisk, generatedAt: now });
  const payload = { _meta: { id: 'ai-forecasts', category: 'forecast', version: '1.0.0', schema_version: '1.0.0', sources: ['strategic-risk-composite'], calculator: 'AIForecasts', provider: result.provider, updated_at: now, duration_ms: Date.now() - t0, checksum: '' }, data: { forecast: result.forecast, provider: result.provider, topRiskCountries: topRisk, generated_at: now } };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('AIForecasts v1.0.0 — provider:', result.provider);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
