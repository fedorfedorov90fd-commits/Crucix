// KiwiSDR Network — Global software-defined radio receiver network
// С демо-данными для автономной работы

// ============================================================
// ДЕМО-ДАННЫЕ (если внешний API недоступен)
// ============================================================
const DEMO_RECEIVERS = [
  { name: 'KFS - Half Moon Bay, CA', location: 'Half Moon Bay, CA', lat: 37.5, lon: -122.5, country: 'USA', url: 'http://kfs.kiwisdr.com:8073/' },
  { name: 'Northern Utah WebSDR', location: 'Utah', lat: 40.5, lon: -111.8, country: 'USA' },
  { name: 'VE3SMC - Ontario', location: 'Ontario', lat: 44.0, lon: -78.0, country: 'Canada' },
  { name: 'G0JPS - UK', location: 'UK', lat: 51.5, lon: -0.1, country: 'UK' },
  { name: 'PA0RWE - Netherlands', location: 'Netherlands', lat: 52.0, lon: 5.0, country: 'Netherlands' },
  { name: 'DL2SDR - Germany', location: 'Germany', lat: 50.0, lon: 10.0, country: 'Germany' },
  { name: 'F1ATB - France', location: 'France', lat: 47.0, lon: 2.0, country: 'France' },
  { name: 'EA1IR - Spain', location: 'Spain', lat: 40.0, lon: -3.0, country: 'Spain' },
  { name: 'I1SFR - Italy', location: 'Italy', lat: 42.0, lon: 12.0, country: 'Italy' },
  { name: 'SV1BDS - Greece', location: 'Greece', lat: 38.0, lon: 24.0, country: 'Greece' },
  { name: 'RA3SDR - Russia', location: 'Russia', lat: 55.0, lon: 37.0, country: 'Russia' },
  { name: 'UA3SDR - Russia', location: 'Russia', lat: 56.0, lon: 38.0, country: 'Russia' },
  { name: 'JA1SDR - Japan', location: 'Japan', lat: 35.0, lon: 139.0, country: 'Japan' },
  { name: 'VK3SDR - Australia', location: 'Australia', lat: -37.0, lon: 145.0, country: 'Australia' },
  { name: 'ZS1SDR - South Africa', location: 'South Africa', lat: -33.0, lon: 18.0, country: 'South Africa' },
  { name: '4X1SDR - Israel', location: 'Israel', lat: 32.0, lon: 35.0, country: 'Israel' },
  { name: 'TA1SDR - Turkey', location: 'Turkey', lat: 39.0, lon: 32.0, country: 'Turkey' },
  { name: 'EP2SDR - Iran', location: 'Iran', lat: 35.0, lon: 51.0, country: 'Iran' },
  { name: 'HS1SDR - Thailand', location: 'Thailand', lat: 13.0, lon: 100.0, country: 'Thailand' },
  { name: '9M2SDR - Malaysia', location: 'Malaysia', lat: 3.0, lon: 101.0, country: 'Malaysia' },
];

// ============================================================
// ПОЛУЧЕНИЕ ДАННЫХ
// ============================================================
export async function getAllReceivers() {
  // Пробуем загрузить реальные данные
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://www.receiverbook.de/map?type=kiwisdr', {
      headers: { 'User-Agent': 'Crucix/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/var\s+receivers\s*=\s*(\[[\s\S]*?\]);/);
      if (match) {
        const sites = JSON.parse(match[1]);
        const flat = [];
        for (const site of sites) {
          const [lon, lat] = site.location?.coordinates || [NaN, NaN];
          const country = site.label?.split(',').pop()?.trim() || '';
          for (const rx of (site.receivers || [site])) {
            flat.push({
              name: rx.label || site.label || '',
              location: site.label || '',
              lat, lon,
              country,
              url: rx.url || site.url || '',
              version: rx.version || '',
              offline: false,
            });
          }
        }
        if (flat.length > 0) {
          console.log(`[KiwiSDR] Загружено ${flat.length} приёмников`);
          return flat;
        }
      }
    }
  } catch (e) {
    console.log('[KiwiSDR] Внешний API недоступен, использую демо-данные');
  }

  // Возвращаем демо-данные
  return DEMO_RECEIVERS.map(r => ({ ...r, offline: false, version: 'demo' }));
}

export async function briefing() {
  const data = await getAllReceivers();
  if (Array.isArray(data)) {
    const countries = [...new Set(data.map(r => r.country).filter(c => c))];
    return {
      total: data.length,
      countries: countries,
      online: data.filter(r => !r.offline).length,
      byCountry: countries.map(c => ({ country: c, count: data.filter(r => r.country === c).length }))
    };
  }
  return { error: data.error };
}

// ============================================================
// API-ОБРАБОТЧИК
// ============================================================
export async function handleKiwiSDRAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (path === '/api/kiwisdr/status' && req.method === 'GET') {
    const data = await getAllReceivers();
    const count = Array.isArray(data) ? data.length : 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      module: 'kiwisdr',
      status: 'online',
      receivers: count,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  if (path === '/api/kiwisdr/receivers' && req.method === 'GET') {
    const data = await getAllReceivers();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, receivers: data }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
}

export default { handleKiwiSDRAPI, getAllReceivers, briefing };
