/**
 * RSSManager — управление RSS-лентами для Crucix
 * Загрузка, парсинг, хранение и обновление RSS-источников
 */
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_PATH = join(__dirname, '../../data/rss');

export class RSSManager {
  constructor() {
    this.dataPath = DATA_PATH;
    this.sources = [];
  }

  async loadSources() {
    try {
      const data = await readFile(join(this.dataPath, 'sources.json'), 'utf-8');
      this.sources = JSON.parse(data);
      return this.sources;
    } catch (e) {
      this.sources = [];
      return [];
    }
  }

  async saveSources() {
    await writeFile(join(this.dataPath, 'sources.json'), JSON.stringify(this.sources, null, 2));
  }

  addSource(url, name, category = 'general') {
    this.sources.push({ url, name, category, added: new Date().toISOString() });
    return this.saveSources();
  }

  async fetchFeed(url) {
    // В реальном проекте здесь используется fetch для получения RSS
    // Возвращаем заглушку для тестирования
    return {
      title: 'RSS Feed',
      entries: [
        { title: 'Пример записи', link: '#', pubDate: new Date().toISOString() }
      ]
    };
  }

  async getAllFeeds() {
    await this.loadSources();
    const results = [];
    for (const source of this.sources) {
      try {
        const feed = await this.fetchFeed(source.url);
        results.push({ source, feed });
      } catch (e) {
        results.push({ source, error: e.message });
      }
    }
    return results;
  }

  async getStats() {
    await this.loadSources();
    return {
      totalSources: this.sources.length,
      categories: [...new Set(this.sources.map(s => s.category))],
      dataPath: this.dataPath
    };
  }
}

export default RSSManager;
