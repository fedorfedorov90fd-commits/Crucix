// widgets/rss-map.js — карта с точками RSS (Leaflet)
// Читает /api/layers/taxonomy-gaps/topics + координаты (fallback — центры стран)
// Использование: <div id="rss-map"></div> + Leaflet CSS/JS + <script type="module" src="/widgets/rss-map.js"></script>

const COUNTRY_COORDS = {
  'россия': [61.5, 105.3], 'russia': [61.5, 105.3],
  'ес': [51.1, 10.4], 'eu': [51.1, 10.4], 'европа': [51.1, 10.4], 'europe': [51.1, 10.4],
  'москва': [55.75, 37.61], 'moscow': [55.75, 37.61],
  'украина': [48.4, 31.2], 'ukraine': [48.4, 31.2],
  'германия': [51.1, 10.4], 'germany': [51.1, 10.4],
  'франция': [46.2, 2.2], 'france': [46.2, 2.2],
  'китай': [35.9, 104.2], 'china': [35.9, 104.2],
  'сша': [37.1, -95.7], 'usa': [37.1, -95.7],
  'байден': [38.9, -77.0], 'biden': [38.9, -77.0],
  'путин': [55.75, 37.61], 'putin': [55.75, 37.61],
  'киев': [50.4, 30.5], 'kyiv': [50.4, 30.5],
  'зеленский': [50.4, 30.5], 'zelensky': [50.4, 30.5],
  'нато': [50.8, 4.4], 'nato': [50.8, 4.4],
};

export async function mountRssMap(containerId = 'rss-map') {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (typeof L === 'undefined') {
    el.innerHTML = '<span style="color:#f59e0b;padding:8px;">Leaflet не загружен. Добавьте <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"> и <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script></span>';
    return;
  }

  try {
    const res = await fetch('/api/layers/taxonomy-gaps/topics?limit=30');
    const data = await res.json();
    const topics = data.topics || [];

    el.style.cssText = 'height:400px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:4px;';

    // Инициализируем карту
    const map = L.map(el).setView([30, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CartoDB',
      maxZoom: 18,
    }).addTo(map);

    for (const t of topics) {
      const name = (t.name || t.topic || '').toLowerCase();
      const coords = COUNTRY_COORDS[name];
      if (!coords) continue;

      const severity = t.severity || 'normal';
      const color = severity === 'high' ? '#ef4444' : severity === 'normal' ? '#f59e0b' : '#4ade80';
      const radius = Math.min(30, 5 + Math.log(t.total_events || 1) * 3);

      L.circleMarker(coords, {
        radius,
        fillColor: color,
        color: '#000',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7,
      }).addTo(map).bindPopup(`
        <b>${t.name || t.topic}</b><br>
        RU: ${t.russian_count} | WEST: ${t.western_count}<br>
        Ratio: ${t.ratio}<br>
        Severity: ${severity}
      `);
    }
  } catch (e) {
    el.innerHTML = `<span style="color:#ef4444;padding:8px;">Ошибка: ${e.message}</span>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountRssMap());
} else {
  mountRssMap();
}
