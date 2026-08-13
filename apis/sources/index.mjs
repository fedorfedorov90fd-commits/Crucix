// apis/sources/index.mjs
// Единый регистратор всех источников

export const sources = {
  acled: {
    name: 'ACLED',
    path: './acled.mjs',
    enabled: false
  },
  adsb: {
    name: 'ADS-B',
    path: './adsb.mjs',
    enabled: false
  },
  bls: {
    name: 'BLS',
    path: './bls.mjs',
    enabled: false
  },
  bluesky: {
    name: 'Bluesky',
    path: './bluesky.mjs',
    enabled: false
  },
  comtrade: {
    name: 'COMTRADE',
    path: './comtrade.mjs',
    enabled: false
  },
  eia: {
    name: 'EIA',
    path: './eia.mjs',
    enabled: false
  },
  epa: {
    name: 'EPA',
    path: './epa.mjs',
    enabled: false
  },
  firms: {
    name: 'FIRMS',
    path: './firms.mjs',
    enabled: false
  },
  fred: {
    name: 'FRED',
    path: './fred.mjs',
    enabled: false
  },
  gdelt: {
    name: 'GDELT',
    path: './gdelt.mjs',
    enabled: false
  },
  gscpi: {
    name: 'GSCPI',
    path: './gscpi.mjs',
    enabled: false
  },
  kiwisdr: {
    name: 'KiwiSDR',
    path: './kiwisdr.mjs',
    enabled: false
  },
  noaa: {
    name: 'NOAA',
    path: './noaa.mjs',
    enabled: false
  },
  ofac: {
    name: 'OFAC',
    path: './ofac.mjs',
    enabled: false
  },
  opensanctions: {
    name: 'OpenSanctions',
    path: './opensanctions.mjs',
    enabled: false
  },
  opensky: {
    name: 'OpenSky',
    path: './opensky.mjs',
    enabled: false
  },
  patents: {
    name: 'Patents',
    path: './patents.mjs',
    enabled: false
  },
  reddit: {
    name: 'Reddit',
    path: './reddit.mjs',
    enabled: false
  },
  reliefweb: {
    name: 'ReliefWeb',
    path: './reliefweb.mjs',
    enabled: false
  },
  safecast: {
    name: 'Safecast',
    path: './safecast.mjs',
    enabled: false
  },
  ships: {
    name: 'Ships',
    path: './ships.mjs',
    enabled: false
  },
  space: {
    name: 'Space',
    path: './space.mjs',
    enabled: false
  },
  telegram: {
    name: 'Telegram',
    path: './telegram.mjs',
    enabled: false
  },
  treasury: {
    name: 'Treasury',
    path: './treasury.mjs',
    enabled: false
  },
  usaspending: {
    name: 'USASpending',
    path: './usaspending.mjs',
    enabled: false
  },
  who: {
    name: 'WHO',
    path: './who.mjs',
    enabled: false
  },
  yfinance: {
    name: 'YFinance',
    path: './yfinance.mjs',
    enabled: false
  }
};

// Функция для получения всех источников
export async function getAllSources() {
  const results = [];
  for (const [key, source] of Object.entries(sources)) {
    if (source.enabled) {
      try {
        const module = await import(source.path);
        results.push({
          id: key,
          name: source.name,
          data: module.default || module
        });
      } catch (e) {
        console.error(`[Sources] Ошибка загрузки ${source.name}:`, e.message);
      }
    }
  }
  return results;
}

// Функция для включения/выключения источника
export function toggleSource(id, enabled) {
  if (sources[id]) {
    sources[id].enabled = enabled;
    return true;
  }
  return false;
}