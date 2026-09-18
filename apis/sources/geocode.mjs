// Простой геокодинг для определения региона по координатам
export default async function handler(req, res) {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);

    if (isNaN(lat) || isNaN(lon)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Invalid coordinates" }));
        return;
    }

    const regions = [
        { name: "Europe", lat: 50, lon: 10 },
        { name: "Middle East", lat: 30, lon: 45 },
        { name: "East Asia", lat: 35, lon: 115 },
        { name: "North America", lat: 45, lon: -100 },
        { name: "South America", lat: -15, lon: -60 },
        { name: "Africa", lat: 5, lon: 20 },
        { name: "Australia", lat: -25, lon: 135 },
        { name: "Russia", lat: 60, lon: 90 },
        { name: "India", lat: 20, lon: 78 },
        { name: "China", lat: 35, lon: 105 },
        { name: "Brazil", lat: -15, lon: -55 },
        { name: "Canada", lat: 55, lon: -100 }
    ];

    let closest = null;
    let minDist = Infinity;

    for (const region of regions) {
        const d = Math.sqrt(Math.pow(lat - region.lat, 2) + Math.pow(lon - region.lon, 2));
        if (d < minDist) {
            minDist = d;
            closest = region;
        }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
        name: closest ? closest.name : "Unknown",
        lat: lat,
        lon: lon
    }));
}
