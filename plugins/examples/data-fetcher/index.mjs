// plugins/examples/data-fetcher/index.mjs
// Пример плагина-фетчера данных

let config = null;
let lastFetch = 0;
let fetchCount = 0;

export async function init(userConfig) {
  config = userConfig;
  console.log(`[data-fetcher] Initialized: url=${config.apiUrl}, interval=${config.intervalMinutes}min`);
}

export async function onTimer(elapsedMs) {
  const now = Date.now();
  const interval = config.intervalMinutes * 60 * 1000;

  if (now - lastFetch < interval) return;
  lastFetch = now;
  fetchCount++;

  try {
    const res = await fetch(config.apiUrl, {
      headers: { 'User-Agent': 'crucix-data-fetcher/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    console.log(`[data-fetcher] Fetched #${fetchCount}: ${JSON.stringify(data).length} bytes`);

    return { ok: true, bytes: JSON.stringify(data).length, fetchCount };
  } catch (e) {
    console.error(`[data-fetcher] Fetch error: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

export function getStatus() {
  return {
    name: 'data-fetcher',
    fetchCount,
    lastFetch: lastFetch ? new Date(lastFetch).toISOString() : null,
  };
}
