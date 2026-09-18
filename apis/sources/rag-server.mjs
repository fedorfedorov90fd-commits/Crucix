/**
 * RAG Server Module
 * HTTP-сервер для RAG-системы (порт 3120)
 *
 * Расположение: /home/ta8_/Рабочий стол/Crucix/apis/sources/rag-server.mjs
 */

import BaseModule from './base.mjs';
import http from 'http';
import url from 'url';

class RAGServer extends BaseModule {
    constructor() {
        super({
            name: 'rag-server',
            version: '1.0.0',
            config: {
                port: 3120,
                host: '0.0.0.0',
                maxQueryLength: 1000,
                defaultLimit: 10
            }
        });

        this.port = this.config.port;
        this.host = this.config.host;
        this.server = null;
        this.startTime = Date.now();
        this.requestCount = 0;

        // Ссылки на другие RAG-модули
        this.router = null;
        this.indexer = null;

        this._log('info', `RAG Server инициализирован (порт ${this.port})`);
    }

    /**
     * Запустить HTTP-сервер
     */
    start() {
        if (this.server) {
            this._log('warn', 'Сервер уже запущен');
            return;
        }

        this.server = http.createServer(this._handleRequest.bind(this));
        this.server.listen(this.port, this.host, () => {
            this._log('info', `RAG Server запущен на http://${this.host}:${this.port}`);
        });

        this.server.on('error', (err) => {
            this._log('error', `Ошибка сервера: ${err.message}`);
        });
    }

    /**
     * Остановить сервер
     */
    stop() {
        if (this.server) {
            this.server.close(() => {
                this._log('info', 'RAG Server остановлен');
                this.server = null;
            });
        }
    }

    async _handleRequest(req, res) {
        this.requestCount++;
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        const method = req.method || 'GET';
        const params = parsedUrl.query;

        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // Логирование
        this._log('info', `${method} ${pathname}`, { params });

        try {
            let result;

            switch (pathname) {
                case '/api/query':
                case '/api/search':
                    result = await this._handleQuery(params, req);
                    break;

                case '/api/status':
                    result = await this._handleStatus();
                    break;

                case '/api/reindex':
                    result = await this._handleReindex(params);
                    break;

                case '/api/router':
                    result = await this._handleRouter(params);
                    break;

                case '/':
                case '/chat':
                case '/chat.html':
                    result = await this._handleChat();
                    break;

                default:
                    result = {
                        status: 404,
                        data: { success: false, error: `Endpoint not found: ${pathname}` }
                    };
            }

            this._sendResponse(res, result.status || 200, result.data || { success: true });

        } catch (error) {
            this._log('error', `Ошибка обработки: ${error.message}`);
            this._sendResponse(res, 500, {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async _handleQuery(params, req) {
        const { q, limit = this.config.defaultLimit, model } = params;

        if (!q) {
            return {
                status: 400,
                data: { success: false, error: 'Missing query parameter (q)' }
            };
        }

        if (q.length > this.config.maxQueryLength) {
            return {
                status: 400,
                data: {
                    success: false,
                    error: `Query too long (max ${this.config.maxQueryLength} characters)`
                }
            };
        }

        // Поиск в индексе через indexer
        const indexerResult = await this.indexer._handleSearch({ q, limit });
        const searchData = indexerResult.data;

        // Маршрутизация через router
        const routerResult = await this.router._handleRoute({
            query: q,
            model: model || 'llama3.2:latest',
            context: searchData.results ? JSON.stringify(searchData.results.slice(0, 3)) : null
        });

        return {
            status: 200,
            data: {
                success: true,
                query: q,
                results: searchData.results || [],
                total: searchData.total || 0,
                context: searchData.results ? searchData.results.slice(0, 3) : [],
                aiResponse: routerResult.data.response || 'No AI response generated',
                model: model || 'llama3.2:latest',
                processingTime: Date.now() - this.startTime,
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
                status: 'running',
                port: this.port,
                host: this.host,
                uptime: Math.round((Date.now() - this.startTime) / 1000),
                requestCount: this.requestCount,
                endpoints: [
                    '/api/query?q=...',
                    '/api/search?q=...&limit=...',
                    '/api/status',
                    '/api/reindex?force=true',
                    '/api/router?action=...',
                    '/chat.html'
                ],
                timestamp: new Date().toISOString()
            }
        };
    }

    async _handleReindex(params) {
        const { force } = params;
        const indexerResult = await this.indexer._handleIndex({ force: force === 'true' });
        return indexerResult;
    }

    async _handleRouter(params) {
        const { action, model, query } = params;
        const routerResult = await this.router._handleRequest(null, null, {
            action: action || 'status',
            model,
            query
        }, null, null);
        return routerResult;
    }

    async _handleChat() {
        // Простая HTML-страница чата
        const html = `<!DOCTYPE html>
<html>
<head>
    <title>RAG Chat - Crucix AI</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d0d1a; color: #e0e0e0; min-height: 100vh; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; height: 100vh; display: flex; flex-direction: column; }
        .header { text-align: center; padding: 20px 0; border-bottom: 1px solid #2a2a3e; }
        .header h1 { font-size: 24px; color: #4d6bfe; font-weight: 600; }
        .header p { color: #8888aa; font-size: 14px; margin-top: 4px; }
        .chat { flex: 1; overflow-y: auto; padding: 20px 0; display: flex; flex-direction: column; gap: 12px; }
        .message { max-width: 80%; padding: 12px 18px; border-radius: 12px; line-height: 1.5; font-size: 14px; }
        .message.user { align-self: flex-end; background: #4d6bfe; color: white; border-radius: 12px 12px 4px 12px; }
        .message.assistant { align-self: flex-start; background: #1a1a2e; color: #e0e0e0; border-radius: 12px 12px 12px 4px; border: 1px solid #2a2a3e; }
        .input-area { display: flex; gap: 10px; padding: 16px 0; border-top: 1px solid #2a2a3e; }
        .input-area input { flex: 1; padding: 12px 16px; background: #1a1a2e; border: 1px solid #2a2a3e; border-radius: 8px; color: #e0e0e0; font-size: 14px; outline: none; }
        .input-area input:focus { border-color: #4d6bfe; }
        .input-area button { padding: 12px 24px; background: #4d6bfe; border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
        .input-area button:hover { opacity: 0.8; }
        .input-area button:disabled { opacity: 0.5; cursor: not-allowed; }
        .loading { color: #8888aa; font-size: 13px; padding: 8px 0; text-align: center; }
        .status-badge { display: inline-block; padding: 4px 12px; background: #1a2a1a; color: #44cc44; border-radius: 12px; font-size: 12px; margin-top: 8px; }
        @media (max-width: 600px) { .container { padding: 10px; } .message { max-width: 90%; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧠 RAG Chat</h1>
            <p>Intelligent search with retrieval-augmented generation</p>
            <span class="status-badge" id="statusBadge">● Online</span>
        </div>
        <div class="chat" id="chatMessages">
            <div class="message assistant">Welcome to RAG Chat! Ask me anything about the Crucix data.</div>
        </div>
        <div class="input-area">
            <input type="text" id="queryInput" placeholder="Ask a question..." autofocus>
            <button id="sendButton">Send</button>
        </div>
    </div>
    <script>
        const chatMessages = document.getElementById('chatMessages');
        const queryInput = document.getElementById('queryInput');
        const sendButton = document.getElementById('sendButton');

        function addMessage(text, type) {
            const div = document.createElement('div');
            div.className = 'message ' + type;
            div.textContent = text;
            chatMessages.appendChild(div);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        function setLoading(loading) {
            sendButton.disabled = loading;
            queryInput.disabled = loading;
        }

        function showLoading() {
            const div = document.createElement('div');
            div.className = 'loading';
            div.id = 'loadingIndicator';
            div.textContent = 'Thinking...';
            chatMessages.appendChild(div);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        function removeLoading() {
            const el = document.getElementById('loadingIndicator');
            if (el) el.remove();
        }

        async function sendQuery() {
            const q = queryInput.value.trim();
            if (!q) return;

            addMessage(q, 'user');
            queryInput.value = '';
            setLoading(true);
            showLoading();

            try {
                const response = await fetch('/api/query?q=' + encodeURIComponent(q) + '&limit=5');
                const data = await response.json();
                removeLoading();

                if (data.success) {
                    let responseText = data.aiResponse || 'No AI response generated.';
                    if (data.results && data.results.length > 0) {
                        responseText += '\\n\\n📊 Found ' + data.total + ' relevant documents:';
                        data.results.slice(0, 3).forEach((r, i) => {
                            responseText += '\\n' + (i+1) + '. ' + r.text.substring(0, 100) + '...';
                        });
                    }
                    addMessage(responseText, 'assistant');
                } else {
                    addMessage('❌ Error: ' + data.error, 'assistant');
                }
            } catch (err) {
                removeLoading();
                addMessage('❌ Connection error: ' + err.message, 'assistant');
            }

            setLoading(false);
        }

        queryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendQuery();
        });
        sendButton.addEventListener('click', sendQuery);

        // Check status
        async function checkStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                const badge = document.getElementById('statusBadge');
                if (data.success) {
                    badge.textContent = '● Online (' + data.module + ' v' + data.version + ')';
                    badge.style.background = '#1a2a1a';
                    badge.style.color = '#44cc44';
                }
            } catch (err) {
                // Status check failed
            }
        }
        checkStatus();
        setInterval(checkStatus, 30000);
    </script>
</body>
</html>`;

        return {
            status: 200,
            data: html,
            isHtml: true
        };
    }

    _sendResponse(res, status, data) {
        if (data.isHtml) {
            res.writeHead(status, { 'Content-Type': 'text/html' });
            res.end(data);
            return;
        }

        res.writeHead(status, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(data, null, 2));
    }
}

// Создаём и экспортируем экземпляр с запуском
const server = new RAGServer();

// Связываем с другими RAG-модулями
import router from './rag-ai-router.mjs';
import indexer from './rag-indexer.mjs';

server.router = router;
server.indexer = indexer;

// Автозапуск
server.start();

export default server;
