// ═══════════════════════════════════════════════════════════════
//  CRUCIX TELEGRAM OSINT LAYER v1.0.0
//  Геопарсинг сообщений: координаты (DD/DMS/MGRS), газетир, sentiment, credibility.
//  Мультиязычный: RU / EN / AR. Без fetch().
// ═══════════════════════════════════════════════════════════════

import { EventEmitter } from 'node:events';

export const GAZETTEER = Object.freeze({
  'москва': { lat: 55.7558, lon: 37.6173, country: 'RU' },
  'moscow': { lat: 55.7558, lon: 37.6173, country: 'RU' },
  'киев': { lat: 50.4501, lon: 30.5234, country: 'UA' },
  'kyiv': { lat: 50.4501, lon: 30.5234, country: 'UA' },
  'london': { lat: 51.5074, lon: -0.1278, country: 'GB' },
  'washington': { lat: 38.9072, lon: -77.0369, country: 'US' },
  'beijing': { lat: 39.9042, lon: 116.4074, country: 'CN' },
  'tehran': { lat: 35.6892, lon: 51.3890, country: 'IR' },
  'damascus': { lat: 33.5138, lon: 36.2765, country: 'SY' },
  'baghdad': { lat: 33.3152, lon: 44.3661, country: 'IQ' },
  'kabul': { lat: 34.5553, lon: 69.2075, country: 'AF' },
  'jerusalem': { lat: 31.7683, lon: 35.2137, country: 'IL' },
  'cairo': { lat: 30.0444, lon: 31.2357, country: 'EG' },
  'istanbul': { lat: 41.0082, lon: 28.9784, country: 'TR' },
  'tokyo': { lat: 35.6762, lon: 139.6503, country: 'JP' },
  'berlin': { lat: 52.5200, lon: 13.4050, country: 'DE' },
  'paris': { lat: 48.8566, lon: 2.3522, country: 'FR' },
  'taipei': { lat: 25.0330, lon: 121.5654, country: 'TW' },
  'seoul': { lat: 37.5665, lon: 126.9780, country: 'KR' },
  'new delhi': { lat: 28.6139, lon: 77.2090, country: 'IN' },
});

const MESSAGE_TYPES = {
  ATTACK: ['взрыв','обстрел','удар','explosion','attack','strike','shelling'],
  MOVEMENT: ['движение','колонна','movement','convoy','troops','deployment'],
  REPORT: ['донесение','сводка','report','summary','update'],
  PHOTO_VIDEO: ['фото','видео','photo','video','footage'],
  ANALYSIS: ['анализ','оценка','analysis','assessment'],
  WARNING: ['внимание','тревога','warning','alert','эвакуац'],
};

const COORD_PATTERNS = [
  { type: 'DD', regex: /(-?\d{1,3}\.\d{2,8})[,\s]+(-?\d{1,3}\.\d{2,8})/g },
  { type: 'DMS', regex: /(\d{1,3})°(\d{1,2})'(\d{1,2}(?:\.\d+)?)"\s*([NS])\s*(\d{1,3})°(\d{1,2})'(\d{1,2}(?:\.\d+)?)"\s*([EW])/gi },
];

export class TelegramOSINTLayer extends EventEmitter {
  constructor({ maxMessages = 5000 } = {}) {
    super();
    this.maxMessages = maxMessages;
    this.messages = [];
  }

  extractCoordinates(text) {
    const out = [];
    for (const p of COORD_PATTERNS) {
      p.regex.lastIndex = 0;
      let m;
      while ((m = p.regex.exec(text)) !== null) {
        let lat, lon;
        if (p.type === 'DD') {
          lat = parseFloat(m[1]); lon = parseFloat(m[2]);
          if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
        } else {
          const ld = parseInt(m[1]), lm = parseInt(m[2]), ls = parseFloat(m[3]), ldir = m[4].toUpperCase();
          const od = parseInt(m[5]), om = parseInt(m[6]), os = parseFloat(m[7]), odir = m[8].toUpperCase();
          lat = ld + lm / 60 + ls / 3600; lon = od + om / 60 + os / 3600;
          if (ldir === 'S') lat = -lat;
          if (odir === 'W') lon = -lon;
        }
        out.push({ lat, lon, type: p.type, raw: m[0], confidence: p.type === 'DD' ? 0.95 : 0.85 });
      }
    }
    return out;
  }

  extractGazetteer(text) {
    const lower = String(text || '').toLowerCase();
    const out = [];
    const seen = new Set();
    for (const [name, coords] of Object.entries(GAZETTEER)) {
      if (lower.includes(name) && !seen.has(name)) {
        seen.add(name);
        out.push({ lat: coords.lat, lon: coords.lon, country: coords.country, placeName: name, type: 'gazetteer', confidence: 0.75 });
      }
    }
    return out;
  }

  classifyMessage(text) {
    const t = String(text || '').toLowerCase();
    let best = { type: 'REPORT', score: 0 };
    for (const [type, kws] of Object.entries(MESSAGE_TYPES)) {
      const score = kws.reduce((s, kw) => s + (t.includes(kw.toLowerCase()) ? 1 : 0), 0);
      if (score > best.score) best = { type, score };
    }
    return best.type;
  }

  analyzeSentiment(text) {
    const t = String(text || '').toLowerCase();
    const neg = ['взрыв','погиб','ранен','удар','разрушен','explosion','killed','destroyed'];
    const pos = ['освобожд','спасен','побед','мирн','liberat','rescued','victory','peace'];
    const urg = ['срочно','тревога','urgent','alert','immediately','evacuate'];
    const n = neg.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
    const p = pos.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
    const u = urg.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
    if (u > 0) return { label: 'urgent', score: -0.8 };
    if (n > p) return { label: 'negative', score: -(n * 0.2) };
    if (p > n) return { label: 'positive', score: p * 0.2 };
    return { label: 'neutral', score: 0 };
  }

  assessCredibility(msg) {
    let s = 30;
    if (msg.views) { s += msg.views > 10000 ? 25 : msg.views > 1000 ? 15 : msg.views > 100 ? 8 : 0; }
    if (msg.hasMedia) s += 15;
    if (msg.hasVideo) s += 10;
    if (msg.forwards > 50) s += 15; else if (msg.forwards > 10) s += 8;
    if (msg.replies > 20) s += 10; else if (msg.replies > 5) s += 5;
    if (msg.edited) s -= 10;
    if (msg.channelVerified) s += 20;
    return Math.max(0, Math.min(100, s));
  }

  _detectLanguage(text) {
    const c = (String(text).match(/[\u0400-\u04FF]/g) || []).length;
    const a = (String(text).match(/[\u0600-\u06FF]/g) || []).length;
    const l = (String(text).match(/[a-zA-Z]/g) || []).length;
    if (c > l && c > a) return 'ru';
    if (a > l && a > c) return 'ar';
    return 'en';
  }

  processMessage(raw) {
    if (!raw) return null;
    const text = String(raw.text || raw.content || '').trim();
    if (text.length < 10) return null;

    const coords = this.extractCoordinates(text);
    const gazetteer = this.extractGazetteer(text);
    const allGeo = [...coords, ...gazetteer].sort((a, b) => b.confidence - a.confidence);
    const best = allGeo[0] || null;

    const entry = {
      id: raw.id || `tg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: text.slice(0, 2000),
      channel: raw.channel || raw.channelName || 'unknown',
      channelVerified: !!raw.channelVerified,
      timestamp: raw.timestamp || raw.date || new Date().toISOString(),
      views: raw.views || 0,
      forwards: raw.forwards || 0,
      replies: raw.replies || 0,
      hasMedia: !!raw.hasMedia,
      hasVideo: !!raw.hasVideo,
      edited: !!raw.edited,
      geo: best,
      allGeoMatches: allGeo.slice(0, 5),
      messageType: this.classifyMessage(text),
      sentiment: this.analyzeSentiment(text).label,
      sentimentScore: this.analyzeSentiment(text).score,
      credibility: this.assessCredibility(raw),
      language: this._detectLanguage(text),
      url: raw.url || null,
      processedAt: new Date().toISOString(),
    };

    this.messages.push(entry);
    if (this.messages.length > this.maxMessages) this.messages.shift();
    this.emit('message:processed', entry);
    return entry;
  }

  processBatch(list) {
    const out = [];
    for (const m of (list || [])) { const r = this.processMessage(m); if (r) out.push(r); }
    return out;
  }

  query({ channel, messageType, country, minCredibility = 0, limit = 100, since, language } = {}) {
    let r = [...this.messages];
    if (channel) r = r.filter(m => m.channel === channel);
    if (messageType) r = r.filter(m => m.messageType === messageType);
    if (country) r = r.filter(m => m.geo?.country === country);
    if (language) r = r.filter(m => m.language === language);
    if (since) { const s = new Date(since).getTime(); r = r.filter(m => new Date(m.timestamp).getTime() >= s); }
    if (minCredibility > 0) r = r.filter(m => m.credibility >= minCredibility);
    r.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return r.slice(0, limit);
  }

  toGeoJSON() {
    const features = this.messages.filter(m => m.geo).map(m => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [m.geo.lon, m.geo.lat] },
      properties: {
        id: m.id, channel: m.channel, messageType: m.messageType,
        sentiment: m.sentiment, credibility: m.credibility,
        views: m.views, forwards: m.forwards, text: m.text.slice(0, 200),
        timestamp: m.timestamp, language: m.language,
      },
    }));
    return { type: 'FeatureCollection', features };
  }

  getStats() {
    const byType = {}, byChannel = {}, byLanguage = {};
    let geo = 0;
    for (const m of this.messages) {
      byType[m.messageType] = (byType[m.messageType] || 0) + 1;
      byChannel[m.channel] = (byChannel[m.channel] || 0) + 1;
      byLanguage[m.language] = (byLanguage[m.language] || 0) + 1;
      if (m.geo) geo++;
    }
    const avgCred = this.messages.length
      ? Math.round(this.messages.reduce((s, m) => s + m.credibility, 0) / this.messages.length)
      : 0;
    return { total: this.messages.length, geolocated: geo, byType, byChannel, byLanguage, avgCredibility: avgCred };
  }
}

let _instance = null;
export function getTelegramOSINTLayer(options) {
  if (!_instance) _instance = new TelegramOSINTLayer(options);
  return _instance;
}
export function resetTelegramOSINTLayer() { _instance = null; }
