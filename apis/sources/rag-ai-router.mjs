/**
 * RAG AI Router Module
 * Маршрутизация запросов к AI-моделям для RAG-системы
 *
 * Расположение: /home/ta8_/Рабочий стол/Crucix/apis/sources/rag-ai-router.mjs
 */

import BaseModule from './base.mjs';

class RAGAIRouter extends BaseModule {
    constructor() {
        super({
            name: 'rag-ai-router',
            version: '1.0.0',
            config: {
                cacheEnabled: false,
                defaultModel: 'llama3.2:latest',
                models: [
                    'llama3.2:latest',
                    'deepseek-r1:7b',
                    'deepseek-r1:1.5b',
                    'phi:2.7b'
                ],
                ollamaUrl: 'http://localhost:11434',
                ragServerUrl: 'http://localhost:3120'
            }
        });

        this.models = this.config.models;
        this.defaultModel = this.config.defaultModel;
        this.ollamaUrl = this.config.ollamaUrl;
        this.ragServerUrl = this.config.ragServerUrl;

        this._log('info', 'RAG AI Router инициализирован');
    }

    async _handleRequest(method, url, params, req, res) {
        const action = params.action || 'route';

        switch (action) {
            case 'route':
                return this._handleRoute(params, req);
            case 'status':
                return this._handleStatus();
            case 'models':
                return this._handleModels();
            default:
                return {
                    status: 404,
                    data: { success: false, error: `Unknown action: ${action}` }
                };
        }
    }

    async _handleRoute(params, req) {
        const { model, query, context, type } = params;
        const selectedModel = model || this.defaultModel;

        if (!query) {
            return {
                status: 400,
                data: { success: false, error: 'Missing query parameter' }
            };
        }

        // Проверяем, доступна ли модель
        if (!this.models.includes(selectedModel)) {
            return {
                status: 400,
                data: {
                    success: false,
                    error: `Model "${selectedModel}" not available. Available: ${this.models.join(', ')}`
                }
            };
        }

        // Имитация маршрутизации
        const routeInfo = {
            selectedModel,
            provider: 'ollama',
            endpoint: `${this.ollamaUrl}/api/generate`,
            context: context ? context.length : 0,
            type: type || 'general',
            timestamp: new Date().toISOString()
        };

        return {
            status: 200,
            data: {
                success: true,
                route: routeInfo,
                query: query,
                // Имитация ответа
                response: `[RAG Router] Processing query with ${selectedModel}...`,
                instructions: {
                    model: selectedModel,
                    temperature: 0.7,
                    maxTokens: 2048,
                    stream: false
                }
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
                status: 'ready',
                defaultModel: this.defaultModel,
                availableModels: this.models,
                ollamaUrl: this.ollamaUrl,
                ragServerUrl: this.ragServerUrl,
                timestamp: new Date().toISOString()
            }
        };
    }

    async _handleModels() {
        return {
            status: 200,
            data: {
                success: true,
                models: this.models.map(m => ({
                    id: m,
                    provider: 'ollama',
                    status: 'available'
                })),
                default: this.defaultModel,
                timestamp: new Date().toISOString()
            }
        };
    }
}

export default new RAGAIRouter();
