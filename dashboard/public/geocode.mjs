// Простой геокодинг для определения региона по координатам
export default async function handler(req, res) {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);

    if (isNaN(lat) || isNaN(lon)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid coordinates' }));
        return;
    }

    // Простейший геокодинг (можно расширить)
    // В реальности используй Nominatim или другую геокодинг-библиотеку
    const regions = [
        { name: 'Europe', lat: 50, lon: 10, radius: 25 },
        { name: 'Middle East', lat: 30, lon: 45, radius: 20 },
        { name: 'East Asia', lat: 35, lon: 115, radius: 20 },
        { name: 'North America', lat: 45, lon: -100, radius: 25 },
        { name: 'South America', lat: -15, lon: -60, radius: 20 },
        { name: 'Africa', lat: 5, lon: 20, radius: 25 },
        { name: 'Australia', lat: -25, lon: 135, radius: 15 }
    ];

    // Вычисляем ближайший регион по расстоянию
    let closest = null;
    let minDist = Infinity;

    for (const region of regions) {
        const d = Math.sqrt(Math.pow(lat - region.lat, 2) + Math.pow(lon - region.lon, 2));
        if (d < minDist) {
            minDist = d;
            closest = region;
        }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        name: closest ? closest.name : 'Unknown',
        lat,
        lon
    }));
}
