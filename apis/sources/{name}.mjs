// ============================================================
// {name}.mjs — Шаблон для новых API-модулей
// ============================================================
// Используется как основа для создания новых API-модулей
// ============================================================

export async function handleNameAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (path === '/api/{name}/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            module: '{name}',
            status: 'online',
            timestamp: new Date().toISOString()
        }));
        return;
    }

    if (path === '/api/{name}/' || path === '/api/{name}') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: {
                message: 'Модуль {name} готов к работе',
                timestamp: new Date().toISOString()
            }
        }));
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Unknown endpoint' }));
}

export default { handleNameAPI };
