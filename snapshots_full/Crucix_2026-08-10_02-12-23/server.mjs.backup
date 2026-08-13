#!/usr/bin/env node
// Crucix Intelligence Engine — Server

import express from 'express';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { synthesize } from './dashboard/inject.mjs';
import config from './crucix.config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3117;
const RUNS_DIR = join(__dirname, 'runs');
const LATEST_FILE = join(RUNS_DIR, 'latest.json');

// Создаём папку runs если её нет
if (!existsSync(RUNS_DIR)) {
  mkdirSync(RUNS_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.static(join(__dirname, 'dashboard/public')));

// ============================================================
// ГЛАВНАЯ СТРАНИЦА — отдаём jarvis.html
// ============================================================
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'dashboard/public/jarvis.html'));
});

// ============================================================
// HEALTH ENDPOINT
// ============================================================
app.get('/api/health', (req, res) => {
  const latest = existsSync(LATEST_FILE) ? JSON.parse(readFileSync(LATEST_FILE, 'utf-8')) : null;
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    lastSweep: latest?.timestamp || null,
    sourcesOk: latest?.sourcesOk || 0,
    sourcesFailed: latest?.sourcesFailed || 0,
    sweepInProgress: false
  });
});

// ============================================================
// DATA ENDPOINT
// ============================================================
app.get('/api/data', (req, res) => {
  try {
    if (existsSync(LATEST_FILE)) {
      const data = JSON.parse(readFileSync(LATEST_FILE, 'utf-8'));
      res.json(data);
    } else {
      res.json({ 
        news: [], 
        sources: {}, 
        sourcesOk: 0, 
        sourcesFailed: 0,
        timestamp: new Date().toISOString() 
      });
    }
  } catch (error) {
    console.error('[Server] Ошибка чтения данных:', error.message);
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// ============================================================
// ЗАПУСК СЕРВЕРА
// ============================================================
app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════════╗`);
  console.log(`  ║           CRUCIX INTELLIGENCE ENGINE         ║`);
  console.log(`  ║          Local Palantir · 26 Sources         ║`);
  console.log(`  ╠══════════════════════════════════════════════╣`);
  console.log(`  ║  Dashboard:  http://localhost:${PORT}          ║`);
  console.log(`  ║  Health:     http://localhost:${PORT}/api/health║`);
  console.log(`  ║  Refresh:    Every 15 min                  ║`);
  console.log(`  ║  LLM:        disabled                       ║`);
  console.log(`  ║  Telegram:   disabled                       ║`);
  console.log(`  ║  Discord:    disabled                       ║`);
  console.log(`  ╚══════════════════════════════════════════════╝\n`);
  console.log(`[Crucix] Server running on http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\n[Crucix] Shutting down...');
  process.exit(0);
});
