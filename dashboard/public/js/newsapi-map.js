// dashboard/public/js/newsapi-map.js
// Интеграция NewsAPI с картой

async function loadNewsAPIMarkers(map) {
    try {
        // Получаем новости по всему миру
        const response = await fetch('/api/newsapi/search?q=*&max=50');
        const data = await response.json();
        
        if (!data.success || !data.events) {
            console.log('[NewsAPI] Нет данных для карты');
            return;
        }
        
        const events = data.events;
        console.log(`[NewsAPI] Загружено ${events.length} событий`);
        
        // Добавляем маркеры на карту
        events.forEach(event => {
            // Пытаемся определить страну по источнику
            const country = getCountryFromSource(event.source);
            
            // Получаем координаты для страны
            const coords = getCountryCoords(country);
            
            if (coords) {
                const marker = L.circleMarker([coords.lat, coords.lon], {
                    radius: 5,
                    color: '#2196f3',
                    fillColor: '#2196f3',
                    fillOpacity: 0.7,
                    weight: 1
                });
                
                marker.bindPopup(`
                    <b>${event.title}</b><br>
                    <small>${event.source} | ${new Date(event.date).toLocaleDateString()}</small><br>
                    <a href="${event.url}" target="_blank">Читать →</a>
                `);
                
                marker.addTo(map);
            }
        });
        
        console.log(`[NewsAPI] Добавлено ${events.length} маркеров на карту`);
        
    } catch (error) {
        console.error('[NewsAPI] Ошибка загрузки маркеров:', error);
    }
}

// Простое определение страны по источнику
function getCountryFromSource(source) {
    const map = {
        'CNN': 'US',
        'BBC': 'GB',
        'Reuters': 'US',
        'AP': 'US',
        'Al Jazeera': 'QA',
        'France 24': 'FR',
        'Deutsche Welle': 'DE',
        'RT': 'RU',
        'TASS': 'RU',
        'RIA Novosti': 'RU',
        'The Guardian': 'GB',
        'The New York Times': 'US',
        'The Washington Post': 'US',
        'The Wall Street Journal': 'US',
        'Bloomberg': 'US',
        'Financial Times': 'GB',
        'The Economist': 'GB'
    };
    
    for (const [key, value] of Object.entries(map)) {
        if (source && source.includes(key)) {
            return value;
        }
    }
    return 'US'; // По умолчанию
}

// Координаты стран (упрощённо)
function getCountryCoords(countryCode) {
    const coords = {
        'US': { lat: 39.8, lon: -98.6 },
        'GB': { lat: 55.4, lon: -3.4 },
        'FR': { lat: 46.6, lon: 2.2 },
        'DE': { lat: 51.2, lon: 10.4 },
        'RU': { lat: 61.5, lon: 105.3 },
        'UA': { lat: 49.0, lon: 31.5 },
        'CN': { lat: 35.9, lon: 104.2 },
        'IN': { lat: 20.6, lon: 78.0 },
        'BR': { lat: -14.2, lon: -51.9 },
        'AU': { lat: -25.3, lon: 133.8 },
        'CA': { lat: 56.1, lon: -106.3 },
        'JP': { lat: 36.2, lon: 138.3 },
        'KR': { lat: 36.5, lon: 127.8 },
        'QA': { lat: 25.4, lon: 51.2 },
        'SA': { lat: 23.9, lon: 45.1 },
        'IL': { lat: 31.0, lon: 34.8 },
        'IR': { lat: 32.4, lon: 53.7 }
    };
    
    return coords[countryCode] || null;
}

// Экспорт для использования в geo-map.html
window.loadNewsAPIMarkers = loadNewsAPIMarkers;