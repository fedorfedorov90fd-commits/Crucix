#!/usr/bin/env node

/**
 * ============================================================
 * КООРДИНАТОР ПРОЕКТА CRUCIX (РАСШИРЕННАЯ ВЕРСИЯ)
 * ============================================================
 * Загружает ВСЕ файлы из PROJECT (копия)/ в память
 * Формирует единый контекст для Ollama
 * ============================================================
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PROJECT_DIR = join(ROOT, 'PROJECT (копия)');
const CONTEXT_FILE = join(ROOT, 'AI_MEMORY', 'FULL_CONTEXT.txt');

// ============================================================
// 1. ЗАГРУЗКА ВСЕХ ФАЙЛОВ ИЗ ПАПКИ
// ============================================================

async function loadAllFiles(dir) {
    const files = await fs.readdir(dir);
    const content = {};
    
    for (const file of files) {
        if (file.endsWith('.txt')) {
            const path = join(dir, file);
            const data = await fs.readFile(path, 'utf-8');
            content[file] = data;
        }
    }
    
    return content;
}

// ============================================================
// 2. ФОРМИРОВАНИЕ ЕДИНОГО КОНТЕКСТА
// ============================================================

function buildContext(content) {
    let context = '=== CRUCIX — ПОЛНЫЙ КОНТЕКСТ ПРОЕКТА ===\n';
    context += `Собрано: ${new Date().toISOString()}\n`;
    context += `Файлов: ${Object.keys(content).length}\n\n`;
    
    // Сортируем по имени файла (чтобы был порядок)
    const sorted = Object.keys(content).sort();
    
    for (const file of sorted) {
        context += `\n${'='.repeat(60)}\n`;
        context += `ФАЙЛ: ${file}\n`;
        context += `${'='.repeat(60)}\n\n`;
        context += content[file];
        context += '\n';
    }
    
    return context;
}

// ============================================================
// 3. СОХРАНЕНИЕ КОНТЕКСТА
// ============================================================

async function saveContext(context) {
    await fs.writeFile(CONTEXT_FILE, context);
    console.log(`✅ Контекст сохранён: ${CONTEXT_FILE}`);
    console.log(`📊 Размер: ${(context.length / 1024).toFixed(0)} KB`);
}

// ============================================================
// 4. ЗАПРОС К ЛОКАЛЬНОМУ AI (Ollama)
// ============================================================

async function queryLocalAI(prompt, context) {
    const url = 'http://localhost:11434/api/generate';
    
    // Берём только первые 15000 символов контекста (чтобы не перегружать)
    const shortContext = context.slice(0, 12000);
    
    const fullPrompt = `Ты — координатор проекта CRUCIX.
    
Вот полная информация о проекте:
${shortContext}

Вопрос пользователя: ${prompt}

Отвечай кратко, но конкретно, ссылаясь на файлы проекта.`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'deepseek-r1:1.5b',
                prompt: fullPrompt,
                stream: false,
                options: {
                    temperature: 0.3,
                    num_predict: 800
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`Ollama ошибка: ${response.status}`);
        }
        
        const data = await response.json();
        return data.response || 'Нет ответа от модели';
    } catch (e) {
        return `Ошибка: ${e.message}`;
    }
}

// ============================================================
// 5. ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

async function main() {
    console.log('='.repeat(60));
    console.log('  КООРДИНАТОР CRUCIX (РАСШИРЕННЫЙ)');
    console.log('='.repeat(60));
    console.log('');
    
    // 1. Загружаем все файлы
    console.log('📁 Загрузка файлов из PROJECT (копия)/...');
    const content = await loadAllFiles(PROJECT_DIR);
    console.log(`✅ Загружено ${Object.keys(content).length} файлов`);
    
    // 2. Формируем контекст
    console.log('🧠 Формирование контекста...');
    const context = buildContext(content);
    console.log(`✅ Контекст создан (${(context.length / 1024).toFixed(0)} KB)`);
    
    // 3. Сохраняем контекст
    await saveContext(context);
    
    // 4. Если есть аргумент — задаём вопрос
    const question = process.argv.slice(2).join(' ');
    if (question) {
        console.log('');
        console.log('💬 Вопрос:', question);
        console.log('');
        console.log('🤖 Ответ:');
        const answer = await queryLocalAI(question, context);
        console.log(answer);
    } else {
        console.log('');
        console.log('💡 Использование: node scripts/coordinator.mjs "Ваш вопрос"');
        console.log('💡 Без вопроса — просто обновляет контекст');
    }
}

// ============================================================
// 6. ЗАПУСК
// ============================================================

main().catch(console.error);
