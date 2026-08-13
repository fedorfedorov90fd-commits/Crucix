#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const CONFIG = {
  PROJECT_DIR: join(ROOT, 'PROJECT'),
  LOGS_DIR: join(ROOT, 'LOGS'),
  OLLAMA_URL: 'http://localhost:11434/api/generate',
  OLLAMA_MODEL: 'deepseek-r1:1.5b',
};

class ProjectCoordinator {
  async loadProjectState() {
    console.log('[Coordinator] 📂 Сканирую состояние проекта...');
    
    let state = '';
    
    // 1. Читаем STATE.txt
    try {
      const s = await fs.readFile(join(CONFIG.PROJECT_DIR, 'STATE.txt'), 'utf-8');
      state += `=== СОСТОЯНИЕ ПРОЕКТА ===\n${s.slice(0, 500)}\n\n`;
    } catch { state += '=== СОСТОЯНИЕ НЕ НАЙДЕНО ===\n\n'; }
    
    // 2. Читаем решения
    try {
      const d = await fs.readFile(join(CONFIG.PROJECT_DIR, 'DECISIONS.txt'), 'utf-8');
      state += `=== ПРИНЯТЫЕ РЕШЕНИЯ ===\n${d.slice(0, 300)}\n\n`;
    } catch { state += '=== РЕШЕНИЯ НЕ НАЙДЕНЫ ===\n\n'; }
    
    // 3. Сканируем код (какие файлы есть)
    state += '=== ФАЙЛЫ ПРОЕКТА ===\n';
    try {
      const files = await fs.readdir(join(ROOT, 'apis'));
      state += `- apis/: ${files.length} файлов\n`;
    } catch { state += '- apis/: папка не найдена\n'; }
    
    try {
      const files = await fs.readdir(join(ROOT, 'scripts'));
      state += `- scripts/: ${files.length} файлов\n`;
    } catch { state += '- scripts/: папка не найдена\n'; }
    
    // 4. Последние изменения в Git
    try {
      const log = execSync('git log --oneline -3', { cwd: ROOT, encoding: 'utf-8' });
      state += `\n=== ПОСЛЕДНИЕ КОММИТЫ ===\n${log}\n`;
    } catch { state += '\n=== GIT НЕ ИНИЦИАЛИЗИРОВАН ===\n'; }
    
    return state;
  }

  async queryAI(prompt) {
    console.log('[Coordinator] ⏳ Отправка запроса к Ollama...');
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(CONFIG.OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: CONFIG.OLLAMA_MODEL,
          prompt: prompt,
          stream: false,
          options: { temperature: 0.3, num_predict: 800 },
        }),
      });

      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.response || 'Нет ответа';
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') throw new Error('⏰ Таймаут');
      throw err;
    }
  }

  async run() {
    console.log('='.repeat(60));
    console.log('  КООРДИНАТОР ПРОЕКТА CRUCIX');
    console.log('='.repeat(60));
    
    const state = await this.loadProjectState();
    
    const prompt = `Ты — координатор open-source проекта Crucix.

На основе этой информации:
${state}

Ответь кратко (3-5 пунктов):
1. Какой статус проекта?
2. Что сделано хорошо?
3. Что требует внимания?
4. Что делать дальше?
5. Есть ли риски?

Ответь на русском языке.`;

    try {
      const response = await this.queryAI(prompt);
      
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = join(CONFIG.LOGS_DIR, `coordinator-${ts}.log`);
      await fs.mkdir(CONFIG.LOGS_DIR, { recursive: true });
      await fs.writeFile(logFile, `=== ЗАПРОС ===\n${prompt}\n\n=== ОТВЕТ ===\n${response}`);
      
      console.log('\n' + '='.repeat(60));
      console.log('  📊 АНАЛИЗ КООРДИНАТОРА');
      console.log('='.repeat(60));
      console.log(response);
      console.log('='.repeat(60));
      console.log(`[Coordinator] ✅ Лог: ${logFile}`);
      console.log('[Coordinator] ✅ Готово');
    } catch (error) {
      console.error(`[Coordinator] ❌ ${error.message}`);
    }
  }
}

const coordinator = new ProjectCoordinator();
coordinator.run().catch(console.error);
