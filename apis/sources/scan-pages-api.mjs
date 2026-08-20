import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '../../dashboard/public');
const apisDir = path.join(__dirname, '../../apis/sources');
const scriptsDir = path.join(__dirname, '../../scripts');
const rootDir = path.join(__dirname, '../..');

function getFiles(dir, ext, label) {
  try {
    const files = fs.readdirSync(dir);
    return files
      .filter(f => f.endsWith(ext) && !f.startsWith('.'))
      .map(f => ({
        name: f,
        path: '/' + dir.split('/').pop() + '/' + f,
        type: label,
        ext: ext
      }));
  } catch (e) {
    return [];
  }
}

export async function scanPages(req, res) {
  try {
    // 1. HTML-страницы (из public)
    const htmlFiles = getFiles(publicDir, '.html', 'Страница')
      .map((f, i) => ({
        number: i + 1,
        id: f.name.replace('.html', ''),
        file: f.name,
        url: '/' + f.name.replace('.html', ''),
        type: 'Страница',
        status: 'online',
        description: 'HTML-страница'
      }));

    // 2. API-модули (из apis/sources/)
    const apiFiles = getFiles(apisDir, '.mjs', 'API-модуль')
      .map((f, i) => ({
        number: htmlFiles.length + i + 1,
        id: f.name.replace('.mjs', ''),
        file: f.name,
        url: '/api/' + f.name.replace('.mjs', ''),
        type: 'API',
        status: 'online',
        description: 'API-эндпоинт'
      }));

    // 3. Скрипты (из scripts/)
    const scriptFiles = getFiles(scriptsDir, '.mjs', 'Скрипт')
      .filter(f => f.name.startsWith('collect-') || f.name === 'check-pages.mjs')
      .map((f, i) => ({
        number: htmlFiles.length + apiFiles.length + i + 1,
        id: f.name.replace('.mjs', ''),
        file: f.name,
        url: '/scripts/' + f.name,
        type: 'Скрипт',
        status: 'online',
        description: 'Сборщик или утилита'
      }));

    // 4. Корневые скрипты
    const rootFiles = ['server.mjs', 'diag.mjs', 'crucix.config.mjs']
      .filter(f => fs.existsSync(path.join(rootDir, f)))
      .map((f, i) => ({
        number: htmlFiles.length + apiFiles.length + scriptFiles.length + i + 1,
        id: f.replace('.mjs', ''),
        file: f,
        url: '/' + f,
        type: 'Корневой',
        status: 'online',
        description: 'Главный файл проекта'
      }));

    // 5. Сборщики (дополнительно)
    const collectorFiles = getFiles(scriptsDir, '.mjs', 'Сборщик')
      .filter(f => f.name.startsWith('collect-'))
      .map((f, i) => ({
        number: htmlFiles.length + apiFiles.length + scriptFiles.length + rootFiles.length + i + 1,
        id: f.name.replace('.mjs', ''),
        file: f.name,
        url: '/scripts/' + f.name,
        type: 'Сборщик',
        status: 'online',
        description: 'Сбор данных из внешних источников'
      }));

    const allPages = [...htmlFiles, ...apiFiles, ...scriptFiles, ...rootFiles, ...collectorFiles];

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      total: allPages.length,
      html: htmlFiles.length,
      api: apiFiles.length,
      scripts: scriptFiles.length,
      root: rootFiles.length,
      collectors: collectorFiles.length,
      pages: allPages
    }));

  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}
