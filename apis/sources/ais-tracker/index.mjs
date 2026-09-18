// ============================================================
// AIS TRACKER — трекер судов (заглушка)
// ============================================================

export async function handleAISTracker(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action') || 'status';

    // Заглушка — возвращаем тестовые данные
    const data = {
        status: 'ok',
        module: 'ais-tracker',
        action: action,
        timestamp: new Date().toISOString(),
        ships: [
            { name: 'Tanker-01', lat: 54.5, lon: 18.5, speed: 12 },
            { name: 'Cargo-02', lat: 55.0, lon: 19.0, speed: 8 },
            { name: 'Fishing-03', lat: 54.0, lon: 18.0, speed: 4 }
        ]
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

export default { handleAISTracker };
