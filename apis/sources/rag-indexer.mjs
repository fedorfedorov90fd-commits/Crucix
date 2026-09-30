/**
 * RAG Indexer Module
 * Создание и обновление векторных индексов для RAG-системы
 *
 * Расположение: /home/ta8_/Рабочий стол/Crucix/apis/sources/rag-indexer.mjs
 */

import BaseModule, { FileUtils } from './base.mjs';
import path from 'path';
import crypto from 'crypto';

class RAGIndexer extends BaseModule {
    constructor() {
        super({
            name: 'rag-indexer',
            version: '1.0.0',
            config: {
                cacheEnabled: false,
                chunkSize: 500,
                overlap: 50,
                embeddingModel: 'nomic-embed-text:latest',
                indexFile: 'rag-index.json'
            }
        });

        this.indexPath = path.join(this.dataDir, this.config.indexFile);
        this.index = this._loadIndex();
        this.chunkSize = this.config.chunkSize;
        this.overlap = this.config.overlap;

        this._log('info', `RAG Indexer инициализирован. Индекс содержит ${this.index.totalChunks || 0} чанков`);
    }

    async _handleRequest(method, url, params, req, res) {
        const action = params.action || 'status';

        switch (action) {
            case 'status':
                return this._handleStatus();
            case 'index':
                return this._handleIndex(params);
            case 'search':
                return this._handleSearch(params);
            case 'clear':
                return this._handleClear();
            default:
                return {
                    status: 404,
                    data: { success: false, error: `Unknown action: ${action}` }
                };
        }
    }

    _loadIndex() {
        const defaultIndex = {
            version: '1.0',
            totalChunks: 0,
            chunks: [],
            lastUpdated: null
        };

        const data = FileUtils.readJSON(this.indexPath);
        if (data && data.version) {
            return data;
        }
        return defaultIndex;
    }

    _saveIndex() {
        this.index.lastUpdated = new Date().toISOString();
        FileUtils.writeJSON(this.indexPath, this.index);
        this._log('info', `Индекс сохранён: ${this.index.totalChunks} чанков`);
    }

    _chunkText(text) {
        const chunks = [];
        const words = text.split(/\s+/);
        const chunkSize = this.chunkSize;
        const overlap = this.overlap;

        for (let i = 0; i < words.length; i += chunkSize - overlap) {
            const chunk = words.slice(i, i + chunkSize).join(' ');
            if (chunk.trim().length > 0) {
                chunks.push(chunk);
            }
        }

        return chunks;
    }

    _generateId(text) {
        return crypto.createHash('sha256').update(text + Date.now().toString()).digest('hex').slice(0, 16);
    }

    async _handleIndex(params) {
        const { source, force } = params;
        const forceFlag = force === 'true' || force === true;

        // Если не принудительно и индекс уже есть
        if (!forceFlag && this.index.totalChunks > 0) {
            return {
                status: 200,
                data: {
                    success: true,
                    message: 'Индекс уже существует. Используйте ?force=true для переиндексации',
                    totalChunks: this.index.totalChunks,
                    lastUpdated: this.index.lastUpdated
                }
            };
        }

        // Сбор данных из корзины
        const basket = this._readBasket();
        const documents = [];

        for (const [name, data] of Object.entries(basket)) {
            if (typeof data === 'object') {
                documents.push({
                    id: name,
                    content: JSON.stringify(data, null, 2),
                    source: 'basket'
                });
            }
        }

        // Разбивка на чанки
        const chunks = [];
        for (const doc of documents) {
            const textChunks = this._chunkText(doc.content);
            for (const chunk of textChunks) {
                chunks.push({
                    id: this._generateId(chunk),
                    text: chunk,
                    source: doc.id,
                    sourceType: doc.source,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Обновление индекса
        this.index.chunks = chunks;
        this.index.totalChunks = chunks.length;
        this.index.lastUpdated = new Date().toISOString();
        this._saveIndex();

        this._log('info', `Индексация завершена: ${chunks.length} чанков из ${documents.length} документов`);

        return {
            status: 200,
            data: {
                success: true,
                totalDocuments: documents.length,
                totalChunks: chunks.length,
                lastUpdated: this.index.lastUpdated,
                chunksPerDocument: documents.length > 0 ? Math.round(chunks.length / documents.length) : 0,
                source: source || 'all'
            }
        };
    }

    async _handleSearch(params) {
        const { q, limit = 10 } = params;

        if (!q) {
            return {
                status: 400,
                data: { success: false, error: 'Missing search query (q)' }
            };
        }

        // Простой поиск по индексу (без векторного поиска)
        const results = [];
        const query = q.toLowerCase();

        for (const chunk of this.index.chunks) {
            const text = chunk.text.toLowerCase();
            if (text.includes(query)) {
                results.push({
                    id: chunk.id,
                    text: chunk.text,
                    source: chunk.source,
                    sourceType: chunk.sourceType,
                    score: text.split(query).length - 1,
                    timestamp: chunk.timestamp
                });
            }
        }

        // Сортировка по релевантности
        results.sort((a, b) => b.score - a.score);

        return {
            status: 200,
            data: {
                success: true,
                query: q,
                total: results.length,
                results: results.slice(0, parseInt(limit)),
                timestamp: new Date().toISOString()
            }
        };
    }

    async _handleStatus() {
        return {
            status: 200,
            data: {
                success: true,
                module: this.name,
                version: this.version,
                totalChunks: this.index.totalChunks,
                lastUpdated: this.index.lastUpdated,
                indexPath: this.indexPath,
                chunkSize: this.chunkSize,
                overlap: this.overlap,
                timestamp: new Date().toISOString()
            }
        };
    }

    async _handleClear() {
        this.index.chunks = [];
        this.index.totalChunks = 0;
        this.index.lastUpdated = null;
        this._saveIndex();

        return {
            status: 200,
            data: {
                success: true,
                message: 'Индекс очищен',
                timestamp: new Date().toISOString()
            }
        };
    }
}

export default new RAGIndexer();
