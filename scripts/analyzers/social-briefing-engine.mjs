#!/usr/bin/env node
// Crucix Analyzer: SocialBriefingEngine v1.0.0
// Читает: data/analytics/semantic/adaptive-news-clustering.json
//         data/analytics/forecast/conflict-escalation-tracker.json
//         data/analytics/specialist/strategic-risk-composite.json
//         data/analytics/market/market-composite.json
//         data/infrastructure/objects.json
// Пишет: data/analytics/forecast/social-briefing.json

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import SocialBriefingEngine from '../../apis/sources/social-briefing-engine.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ANALYTICS = join(ROOT, 'data', 'analytics');
const OUT_DIR = join(ANALYTICS, 'forecast');
const OUT_FILE = join(OUT_DIR, 'social-briefing.json');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf-8')); }
  catch { return fallback; }
}

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();

  // Формат из аргументов командной строки
  const format = process.argv[2] || 'daily';
  if (!['daily', 'alert', 'summary'].includes(format)) {
    throw new Error(`Неизвестный формат: ${format}. Допустимо: daily, alert, summary`);
  }

  // Собираем данные из всех готовых анализаторов
  const clusters = await readJson(join(ANALYTICS, 'semantic', 'adaptive-news-clustering.json'), { data: { clusters: [] } });
  const escalations = await readJson(join(ANALYTICS, 'forecast', 'conflict-escalation-tracker.json'), { data: { conflicts: [] } });
  const risks = await readJson(join(ANALYTICS, 'specialist', 'strategic-risk-composite.json'), { data: { countries: {} } });
  const markets = await readJson(join(ANALYTICS, 'market', 'market-composite.json'), { data: { composite: null } });

  // Собираем топ риски стран
  const riskEntries = Object.entries(risks.data?.countries || {})
    .filter(([k, v]) => typeof v.score === 'number')
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 10)
    .map(([code, v]) => ({ regionId: code, score: v.score, level: v.regime }));

  const inputData = {
    clusters: (clusters.data?.clusters || []).slice(0, 20),
    escalations: (escalations.data?.conflicts || []).slice(0, 10),
    risks: riskEntries,
    markets: markets.data?.composite || null,
  };

  const sbe = new SocialBriefingEngine();
  const brief = await sbe.generate({ format, data: inputData });

  const payload = {
    _meta: {
      id: 'social-briefing',
      category: 'forecast',
      version: '1.0.0',
      schema_version: '1.0.0',
      sources: ['adaptive-news-clustering', 'conflict-escalation-tracker', 'strategic-risk-composite', 'market-composite'],
      calculator: 'SocialBriefingEngine',
      format,
      updated_at: now,
      duration_ms: Date.now() - t0,
      checksum: '',
      provider: brief.provider,
      description: 'Генерация человекочитаемых брифов через локальный LLM (Ollama). Форматы: daily, alert, summary.',
    },
    data: {
      brief: {
        text: brief.text,
        provider: brief.provider,
        format: brief.format,
        metadata: brief.metadata,
        error: brief.error || null,
      },
      generated_at: now,
    },
  };

  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('════════════════════════════════════════════');
  console.log('SocialBriefingEngine v1.0.0 — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Формат:', format);
  console.log('Провайдер:', brief.provider);
  console.log('Входные данные: clusters=' + inputData.clusters.length + ', escalations=' + inputData.escalations.length + ', risks=' + inputData.risks.length);
  console.log('');
  console.log('Текст брифа (первые 500 символов):');
  console.log(brief.text.slice(0, 500));
  console.log('');
  console.log('Файл записан:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); console.error(e.stack); process.exit(1); });
