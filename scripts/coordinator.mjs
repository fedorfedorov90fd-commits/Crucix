#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const CONFIG = {
  PROJECT_DIR: join(ROOT, 'PROJECT'),
  LOGS_DIR: join(ROOT, 'LOGS'),
  OLLAMA_URL: 'http://localhost:11434/api/generate',
  OLLAMA_MODEL: 'deepseek-r1:1.5b',
};

class ProjectCoordinator {
  async loadState() {
    try {
      const state = await fs.readFile(join(CONFIG.PROJECT_DIR, 'STATE.txt'), 'utf-8');
      return state.slice(0, 500);
    } catch {
      return 'Состояние не найдено';
    }
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
          options: {
            temperature: 0.3,
            num_predict: 500,
          },
        }),
      });

      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return data.response || 'Нет ответа от модели';
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error('⏰ Таймаут: модель отвечает слишком долго');
      }
      throw err;
    }
  }

  async run() {
    console.log('='.repeat(60));
    console.log('  КООРДИНАТОР ПРОЕКТА CRUCIX');
    console.log('='.repeat(60));
    
    const state = await this.loadState();
    
    const prompt = `Ты — координатор open-source проекта Crucix.

Текущее состояние:
${state}

Ответь кратко (3-5 предложений):
1. Какой статус проекта?
2. Что делать дальше?
3. Есть ли проблемы?

Ответь на русском языке.`;

    try {
      const response = await this.queryAI(prompt);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = join(CONFIG.LOGS_DIR, `coordinator-${timestamp}.log`);
      await fs.mkdir(CONFIG.LOGS_DIR, { recursive: true });
      await fs.writeFile(logFile, `=== ЗАПРОС ===\n${prompt}\n\n=== ОТВЕТ ===\n${response}`);
      
      console.log('\n' + '='.repeat(60));
      console.log('  📊 АНАЛИЗ КООРДИНАТОРА');
      console.log('='.repeat(60));
      console.log(response);
      console.log('='.repeat(60));
      console.log(`[Coordinator] ✅ Лог сохранён: ${logFile}`);
      console.log('[Coordinator] ✅ Готово');
    } catch (error) {
      console.error(`[Coordinator] ❌ Ошибка: ${error.message}`);
    }
  }
}

const coordinator = new ProjectCoordinator();
coordinator.run().catch(console.error);
