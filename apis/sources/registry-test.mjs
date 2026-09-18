console.log('[Registry-Test] 🔥 МОДУЛЬ ЗАГРУЖЕН');

export default async function handler(req, res) {
    console.log('[Registry-Test] 📥 ЗАПРОС:', req.url);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        success: true,
        message: 'Registry test работает!',
        timestamp: new Date().toISOString()
    }));
}
