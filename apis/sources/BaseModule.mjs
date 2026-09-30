/**
 * BaseModule — базовый класс для всех RAG-модулей Crucix
 * Предоставляет общие методы для работы с хранилищем, индексацией и поиском
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_PATH = join(__dirname, '../../data/rag');

export class BaseModule {
  constructor(name) {
    this.name = name;
    this.dataPath = join(DATA_PATH, name);
    this.ensureDir();
  }

  async ensureDir() {
    try {
      await mkdir(this.dataPath, { recursive: true });
    } catch (e) { /* папка уже существует */ }
  }

  async loadJSON(file) {
    try {
      const data = await readFile(join(this.dataPath, file), 'utf-8');
      return JSON.parse(data);
    } catch (e) { return null; }
  }

  async saveJSON(file, data) {
    await this.ensureDir();
    await writeFile(join(this.dataPath, file), JSON.stringify(data, null, 2));
  }

  generateId() {
    return crypto.randomBytes(8).toString('hex');
  }

  async search(query, options = {}) {
    // Базовый поиск — переопределяется в дочерних классах
    const index = await this.loadJSON('index.json') || [];
    const results = index.filter(item => 
      item.text && item.text.toLowerCase().includes(query.toLowerCase())
    );
    return results.slice(0, options.limit || 10);
  }

  async indexText(text, metadata = {}) {
    const index = await this.loadJSON('index.json') || [];
    const entry = {
      id: this.generateId(),
      text,
      metadata,
      timestamp: new Date().toISOString()
    };
    index.push(entry);
    await this.saveJSON('index.json', index);
    return entry;
  }

  async getStats() {
    const index = await this.loadJSON('index.json') || [];
    return {
      name: this.name,
      entries: index.length,
      dataPath: this.dataPath
    };
  }
}

export default BaseModule;
