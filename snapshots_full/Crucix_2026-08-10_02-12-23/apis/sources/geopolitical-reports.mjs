/**
 * ============================================================
 * МОДУЛЬ: ГЕОПОЛИТИКА + AI
 * ============================================================
 * 
 * ЧТО ДЕЛАЕТ:
 *   Собирает новости из RSS-лент, указанных в OPML-файле
 *   Сохраняет их в папку data/ai_raw/geopolitical-reports/
 *   Отправляет собранные новости в AI для анализа
 *
 * КАК НАСТРОИТЬ ИСТОЧНИКИ:
 *   1. Файл: data/feeds/feeds.opml (стандартный OPML-формат)
 *   2. Если файла нет — создаётся автоматически
 *   3. Редактируй в любом текстовом редакторе
 *   4. Или импортируй из любимого RSS-ридера
 *   5. Модуль подхватит изменения при следующем сборе
 *
 * ПРИМЕР СОДЕРЖИМОГО feeds.opml:
 *   <?xml version="1.0" encoding="UTF-8"?>
 *   <opml version="1.0">
 *     <body>
 *       <outline text="Российские СМИ">
 *         <outline type="rss" text="ТАСС" xmlUrl="https://tass.ru/rss/v2.xml"/>
 *         <outline type="rss" text="РИА Новости" xmlUrl="https://ria.ru/export/rss2/index.xml"/>
 *       </outline>
 *       <outline text="Международные">
 *         <outline type="rss" text="Reuters" xmlUrl="https://www.reuters.com/rss/"/>
 *       </outline>
 *     </body>
 *   </opml>
 *
 * КАК ИСПОЛЬЗОВАТЬ В CRUCIX:
 *   1. Панель "🌍 ГЕОПОЛИТИКА + AI" в интерфейсе
 *   2. Настройки сохраняются в localStorage
 *   3. Кнопка "Анализировать" отправляет новости в AI
 * ============================================================
 */

import fs from 'fs/promises';
import path from 'path';

// ============================================================
// ПУТИ К ФАЙЛАМ
// ============================================================
const DATA_DIR = path.join(process.cwd(), 'data');
const FEEDS_DIR = path.join(DATA_DIR, 'feeds');
const FEEDS_FILE = path.join(FEEDS_DIR, 'feeds.opml');

// ============================================================
// БАЗОВЫЙ OPML (если файла нет)
// ============================================================
const DEFAULT_OPML = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>Geopolitical Reports Feeds</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
  </head>
  <body>
    <outline text="Российские СМИ">
      <outline type="rss" text="ТАСС" xmlUrl="https://tass.ru/rss/v2.xml"/>
      <outline type="rss" text="РИА Новости" xmlUrl="https://ria.ru/export/rss2/index.xml"/>
      <outline type="rss" text="Интерфакс" xmlUrl="http://interfax.ru/rss.asp"/>
      <outline type="rss" text="Lenta.ru" xmlUrl="https://lenta.ru/rss"/>
      <outline type="rss" text="Коммерсантъ" xmlUrl="http://www.kommersant.ru/RSS/main.xml"/>
    </outline>
    <outline text="Международные СМИ">
      <outline type="rss" text="Reuters" xmlUrl="https://www.reuters.com/rss/"/>
      <outline type="rss" text="Associated Press" xmlUrl="https://feeds.ap.org/rss/"/>
      <outline type="rss" text="BBC News" xmlUrl="https://feeds.bbci.co.uk/news/rss.xml"/>
      <outline type="rss" text="Al Jazeera" xmlUrl="https://www.aljazeera.com/xml/rss/all.xml"/>
      <outline type="rss" text="France 24" xmlUrl="https://www.france24.com/en/rss"/>
    </outline>
  </body>
</opml>`;

// ============================================================
// ПАРСЕР OPML
// ============================================================
function parseOPML(xml) {
  const feeds = [];
  const outlineRegex = /<outline[^>]*>/g;
  let match;
  
  while ((match = outlineRegex.exec(xml)) !== null) {
    const tag = match[0];
    const typeMatch = tag.match(/type="([^"]*)"/);
    const textMatch = tag.match(/text="([^"]*)"/);
    const urlMatch = tag.match(/xmlUrl="([^"]*)"/);
    
    if (typeMatch && typeMatch[1] === 'rss' && textMatch && urlMatch) {
      feeds.push({
        name: textMatch[1],
        url: urlMatch[1],
        category: 'geopolitics',
        language: 'unknown'
      });
    }
  }
  
  return feeds;
}

// ============================================================
// ЗАГРУЗКА ИСТОЧНИКОВ ИЗ OPML
// ============================================================
async function loadFeedsFromOPML() {
  try {
    // Проверяем, существует ли папка
    await fs.mkdir(FEEDS_DIR, { recursive: true });
    
    // Проверяем, существует ли файл
    try {
      await fs.access(FEEDS_FILE);
    } catch {
      // Создаём файл с базовым набором
      await fs.writeFile(FEEDS_FILE, DEFAULT_OPML, 'utf-8');
      console.log('[Geopolitical Reports] Создан базовый OPML-файл:', FEEDS_FILE);
    }
    
    // Читаем и парсим
    const content = await fs.readFile(FEEDS_FILE, 'utf-8');
    const feeds = parseOPML(content);
    
    if (feeds.length === 0) {
      console.warn('[Geopolitical Reports] В OPML-файле нет RSS-лент. Используйте стандартный формат.');
      // Возвращаем базовый набор на всякий случай
      return parseOPML(DEFAULT_OPML);
    }
    
    console.log(`[Geopolitical Reports] Загружено ${feeds.length} источников из OPML`);
    return feeds;
    
  } catch (error) {
    console.error('[Geopolitical Reports] Ошибка загрузки OPML:', error.message);
    return parseOPML(DEFAULT_OPML);
  }
}

// ============================================================
// НАСТРОЙКИ
// ============================================================
const DEFAULT_SETTINGS = {
  fetchInterval: 60,
  displayMode: 'both',
  saveForAI: true,
  aiProvider: 'auto',
  aiApiKey: '',
  aiModel: '',
  aiTemperature: 0.1,
  aiAutoSelect: true,
  storageDays: 7
};

const AI_PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    requiresKey: true,
    free: false
  },
  openrouter: {
    name: 'OpenRouter (бесплатный)',
    baseURL: 'https://openrouter.ai/api/v1',
    models: ['deepseek/deepseek-v4-flash:free', 'mistralai/mistral-7b-instruct:free'],
    requiresKey: true,
    free: true
  },
  ollama: {
    name: 'Ollama (локальный)',
    baseURL: 'http://localhost:11434/api',
    models: ['llama3.1', 'deepseek-r1:7b', 'mistral'],
    requiresKey: false,
    free: true
  }
};

// ============================================================
// ОСНОВНОЙ МОДУЛЬ
// ============================================================
export default {
  name: 'Geopolitical Reports',
  fetchInterval: 3600000,

  getSettings() {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('geopolitical_reports_settings');
      if (saved) {
        try {
          return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        } catch {
          return DEFAULT_SETTINGS;
        }
      }
    }
    return DEFAULT_SETTINGS;
  },

  saveSettings(settings) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('geopolitical_reports_settings', JSON.stringify(settings));
    }
  },

  // ===== UI НАСТРОЕК =====
  renderSettings() {
    const settings = this.getSettings();
    const providersHtml = Object.entries(AI_PROVIDERS).map(([key, provider]) => `
      <option value="${key}" ${settings.aiProvider === key ? 'selected' : ''}>
        ${provider.name} ${provider.free ? '(бесплатно)' : ''}
      </option>
    `).join('');

    const modelOptions = settings.aiProvider && AI_PROVIDERS[settings.aiProvider]
      ? AI_PROVIDERS[settings.aiProvider].models.map(m => `
          <option value="${m}" ${settings.aiModel === m ? 'selected' : ''}>${m}</option>
        `).join('')
      : '<option value="">Выберите провайдера сначала</option>';

    return `
      <div class="geopolitical-settings" style="padding:12px;background:#1a1a2e;border-radius:8px;margin:8px 0;">
        <h3 style="color:#00d4ff;font-size:11px;margin-bottom:8px;">🤖 Настройки AI</h3>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          <div>
            <label style="display:block;color:#aaa;font-size:9px;margin-bottom:2px;">Провайдер</label>
            <select id="aiProvider" style="width:100%;padding:4px 8px;background:#16213e;color:#fff;border:1px solid #333;border-radius:4px;font-size:10px;">
              ${providersHtml}
            </select>
          </div>
          <div>
            <label style="display:block;color:#aaa;font-size:9px;margin-bottom:2px;">Модель</label>
            <select id="aiModel" style="width:100%;padding:4px 8px;background:#16213e;color:#fff;border:1px solid #333;border-radius:4px;font-size:10px;">
              ${modelOptions}
            </select>
          </div>
        </div>

        <div style="margin:4px 0;">
          <label style="display:block;color:#aaa;font-size:9px;margin-bottom:2px;">API-ключ</label>
          <input type="password" id="aiApiKey" value="${settings.aiApiKey || ''}" 
                 style="width:100%;padding:4px 8px;background:#16213e;color:#fff;border:1px solid #333;border-radius:4px;font-size:10px;"
                 placeholder="Введите API-ключ...">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;">
          <div>
            <label style="display:block;color:#aaa;font-size:9px;margin-bottom:2px;">
              Температура: <span id="tempVal">${settings.aiTemperature}</span>
            </label>
            <input type="range" id="aiTemperature" min="0" max="1" step="0.05" value="${settings.aiTemperature}"
                   style="width:100%;accent-color:#00d4ff;">
          </div>
          <div>
            <label style="display:block;color:#aaa;font-size:9px;margin-bottom:2px;">
              Новости хранить дней
            </label>
            <input type="number" id="storageDaysInput" min="1" max="9999" value="${settings.storageDays || 7}"
                   style="width:100%;padding:4px 8px;background:#16213e;color:#fff;border:1px solid #333;border-radius:4px;font-size:10px;">
          </div>
        </div>

        <div style="margin:4px 0;display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="autoSelect" ${settings.aiAutoSelect ? 'checked' : ''}
                 style="accent-color:#00d4ff;">
          <label style="color:#aaa;font-size:9px;cursor:pointer;">Авто-выбор</label>
        </div>

        <div style="margin:4px 0;padding:6px 8px;background:rgba(0,212,255,0.06);border-radius:4px;border:1px solid rgba(0,212,255,0.1);">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
            <span style="font-size:9px;color:#6a8a82;">📡 Источники: <span id="feedCount">0</span></span>
            <span style="font-size:8px;color:#6a8a82;font-family:var(--mono);">
              Файл: data/feeds/feeds.opml
            </span>
          </div>
          <div style="font-size:8px;color:#6a8a82;margin-top:2px;">
            <span id="feedList" style="display:block;max-height:40px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Загрузка...</span>
          </div>
          <div style="margin-top:4px;">
            <button id="reloadFeedsBtn" style="padding:2px 8px;background:rgba(0,212,255,0.1);color:#00d4ff;border:1px solid rgba(0,212,255,0.2);border-radius:4px;font-size:8px;cursor:pointer;font-family:var(--mono);">
              🔄 Обновить список
            </button>
            <span style="font-size:8px;color:#6a8a82;margin-left:6px;">
              (редактируй ${FEEDS_FILE})
            </span>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;margin:4px 0;flex-wrap:wrap;">
          <button id="saveAISettings" style="padding:4px 12px;background:#00d4ff;color:#000;border:none;border-radius:4px;font-size:10px;font-weight:600;cursor:pointer;">
            💾 Сохранить настройки
          </button>
          <span id="saveStatus" style="font-size:10px;color:#0f0;"></span>
        </div>
      </div>
    `;
  },

  // ===== ОБНОВЛЕНИЕ СПИСКА ИСТОЧНИКОВ В ИНТЕРФЕЙСЕ =====
  async updateFeedListUI() {
    try {
      const feeds = await loadFeedsFromOPML();
      const countEl = document.getElementById('feedCount');
      const listEl = document.getElementById('feedList');
      
      if (countEl) countEl.textContent = feeds.length;
      if (listEl) {
        const names = feeds.map(f => f.name).join(', ');
        listEl.textContent = names || 'Нет источников';
      }
    } catch {
      // Игнорируем ошибки
    }
  },

  // ===== СОХРАНЕНИЕ НАСТРОЕК =====
  handleSettingsSave() {
    if (typeof document === 'undefined') return;
    
    const settings = this.getSettings();
    const provider = document.getElementById('aiProvider')?.value || settings.aiProvider;
    const apiKey = document.getElementById('aiApiKey')?.value || settings.aiApiKey;
    const model = document.getElementById('aiModel')?.value || settings.aiModel;
    const temperature = parseFloat(document.getElementById('aiTemperature')?.value || settings.aiTemperature);
    const autoSelect = document.getElementById('autoSelect')?.checked ?? settings.aiAutoSelect;
    const storageDays = parseInt(document.getElementById('storageDaysInput')?.value || settings.storageDays || 7);
    
    const newSettings = {
      ...settings,
      aiProvider: provider,
      aiApiKey: apiKey,
      aiModel: model,
      aiTemperature: temperature,
      aiAutoSelect: autoSelect,
      storageDays: storageDays
    };

    this.saveSettings(newSettings);
    
    const status = document.getElementById('saveStatus');
    if (status) {
      status.textContent = '✅ Сохранено!';
      setTimeout(() => { status.textContent = ''; }, 3000);
    }
  },

  // ===== АВТО-ВЫБОР =====
  autoSelectProvider() {
    const settings = this.getSettings();
    if (settings.aiAutoSelect || !settings.aiProvider || settings.aiProvider === 'auto') {
      return 'openrouter';
    }
    return settings.aiProvider;
  },

  // ===== ОСНОВНОЙ FETCH =====
  async fetch() {
    const settings = this.getSettings();
    
    // Загружаем источники из OPML
    const feedSources = await loadFeedsFromOPML();
    
    if (feedSources.length === 0) {
      console.warn('[Geopolitical Reports] Нет источников в OPML-файле');
      return { type: 'FeatureCollection', features: [] };
    }

    console.log(`[Geopolitical Reports] Сбор данных из ${feedSources.length} источников...`);

    const reports = [];
    for (const source of feedSources) {
      try {
        const feedData = await this.fetchFeed(source.url);
        const parsed = this.parseFeed(feedData, source);
        reports.push(...parsed);
        console.log(`[Geopolitical Reports] Загружено ${parsed.length} новостей из ${source.name}`);
      } catch (error) {
        console.warn(`[Geopolitical Reports] Ошибка при загрузке ${source.name}:`, error.message);
      }
    }

    console.log(`[Geopolitical Reports] Всего собрано ${reports.length} новостей`);

    if (settings.saveForAI) {
      await this.saveForAI(reports);
    }

    if (settings.aiProvider && settings.aiProvider !== 'none') {
      await this.runAIAnalysis(reports);
    }

    return this.formatForDisplay(reports, settings.displayMode);
  },

  // ===== ЗАПУСК AI-АНАЛИЗА =====
  async runAIAnalysis(reports) {
    const settings = this.getSettings();
    const provider = this.autoSelectProvider();
    
    console.log(`[Geopolitical Reports] Запуск AI-анализа через ${provider}...`);

    const summaries = reports.slice(0, 100).map(r => ({
      title: r.title,
      source: r.source,
      date: r.date
    }));

    const prompt = `
Ты — военно-политический аналитик. Проанализируй следующие новости за сегодня.

Задачи:
1. Выдели 5 самых важных событий
2. Оцени, какие из них могут указывать на эскалацию международного конфликта
3. Сделай краткий прогноз на ближайшие 48 часов

Новости:
${JSON.stringify(summaries, null, 2)}

Ответь сухо, фактологично, без эмоций.
`;

    let result;
    try {
      if (provider === 'ollama') {
        result = await this.callOllama(prompt);
      } else if (provider === 'deepseek') {
        result = await this.callDeepSeek(prompt, settings.aiApiKey);
      } else {
        result = await this.callOpenRouter(prompt, settings.aiApiKey);
      }
    } catch (error) {
      console.error('[Geopolitical Reports] Ошибка AI-анализа:', error.message);
      return;
    }

    const aiDir = path.join(process.cwd(), 'data', 'ai_raw', 'geopolitical-reports');
    await fs.mkdir(aiDir, { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    const analysisPath = path.join(aiDir, `analysis_${today}.md`);
    await fs.writeFile(analysisPath, `# Анализ от ${today}\n\nПровайдер: ${provider}\n\n${result}`);

    console.log(`[Geopolitical Reports] Анализ сохранён: ${analysisPath}`);
  },

  // ===== ВЫЗОВЫ К API =====
  async callOllama(prompt) {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.1',
        prompt: prompt,
        stream: false
      })
    });
    const data = await response.json();
    return data.response || data.message?.content || 'Нет ответа от Ollama';
  },

  async callDeepSeek(prompt, apiKey) {
    if (!apiKey) throw new Error('API-ключ DeepSeek не указан');
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'Ты — аналитик, отвечаешь сухо, фактологично, без эмоций.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1
      })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Нет ответа от DeepSeek';
  },

  async callOpenRouter(prompt, apiKey) {
    const headers = {
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://crucix.local',
      'X-Title': 'Crucix Geo AI'
    };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: 'deepseek/deepseek-v4-flash:free',
        messages: [
          { role: 'system', content: 'Ты — аналитик, отвечаешь сухо, фактологично, без эмоций.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1
      })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Нет ответа от OpenRouter';
  },

  // ===== RSS-ФУНКЦИИ =====
  async fetchFeed(url) {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrucixBot/1.0)' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  },

  parseFeed(xml, source) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title>([\s\S]*?)<\/title>/;
    const pubDateRegex = /<pubDate>([\s\S]*?)<\/pubDate>/;
    const linkRegex = /<link>([\s\S]*?)<\/link>/;
    const descriptionRegex = /<description>([\s\S]*?)<\/description>/;

    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      const titleMatch = itemXml.match(titleRegex);
      const pubMatch = itemXml.match(pubDateRegex);
      const linkMatch = itemXml.match(linkRegex);
      const descMatch = itemXml.match(descriptionRegex);

      if (titleMatch && linkMatch) {
        items.push({
          id: `geopolitical-${Date.now()}-${items.length}`,
          title: this.cleanText(titleMatch[1]),
          date: pubMatch ? new Date(pubMatch[1]).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          url: linkMatch[1],
          summary: descMatch ? this.cleanText(descMatch[1]).slice(0, 500) : 'Нет описания',
          source: source.name,
          sourceId: source.name.replace(/\s/g, '_').toLowerCase(),
          category: source.category || 'geopolitics',
          language: 'unknown',
          type: 'analysis'
        });
      }
    }
    return items;
  },

  cleanText(text) {
    return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  },

  // ===== СОХРАНЕНИЕ В КОРЗИНУ =====
  async saveForAI(reports) {
    try {
      const aiDir = path.join(process.cwd(), 'data', 'ai_raw', 'geopolitical-reports');
      await fs.mkdir(aiDir, { recursive: true });

      const today = new Date().toISOString().slice(0, 10);
      const filePath = path.join(aiDir, `${today}.json`);

      let existing = [];
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) existing = parsed;
        else if (parsed?.reports) existing = parsed.reports;
      } catch {}

      const allReports = [...existing, ...reports];
      const unique = allReports.filter((item, index, self) =>
        index === self.findIndex(t => t.url === item.url)
      );

      await fs.writeFile(filePath, JSON.stringify({
        source: 'geopolitical-reports',
        fetchedAt: new Date().toISOString(),
        totalReports: unique.length,
        reports: unique
      }, null, 2));

      console.log(`[Geopolitical Reports] Данные сохранены: ${filePath} (${unique.length} записей)`);
    } catch (error) {
      console.warn('[Geopolitical Reports] Ошибка при сохранении:', error.message);
    }
  },

  // ===== ОТОБРАЖЕНИЕ =====
  formatForDisplay(reports, displayMode) {
    const result = { type: 'FeatureCollection', features: [] };
    const coords = { lat: 55.75, lng: 37.61 };

    if (displayMode === 'map' || displayMode === 'both') {
      reports.forEach(report => {
        result.features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
          properties: {
            title: report.title,
            date: report.date,
            url: report.url,
            summary: report.summary,
            source: report.source,
            category: report.category,
            language: report.language || 'unknown'
          }
        });
      });
    }

    if (displayMode === 'list' || displayMode === 'both') {
      result.items = reports.map(r => ({ ...r, type: 'report' }));
    }

    return result;
  }
};
