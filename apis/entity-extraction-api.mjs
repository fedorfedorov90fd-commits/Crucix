/**
 * entity-extraction-api.mjs — автономный NER (Named Entity Recognition)
 * Зависимости: ноль. Только встроенные модули Node.js.
 * Портабельно: все пути относительные, никаких хардкодов.
 */

const STOP_WORDS = new Set([
  'что','это','как','так','для','над','под','при','про','без','вне',
  'между','перед','среди','около','вокруг','после','до','из','от','к',
  'по','на','в','с','у','о','об','не','ни','но','и','или','же','ли',
  'бы','то','этом','этот','эта','эти','этих','того','этому','который',
  'которая','которые','которых','все','всех','всему','всего','ещё','уже',
  'только','даже','если','когда','чтобы','потому','поэтому',
  'the','a','an','is','are','was','were','be','been','being','have',
  'has','had','do','does','did','will','would','could','should','may',
  'might','must','can','this','that','these','those','and','or','but',
  'not','no','for','in','on','at','to','of','from','with','by','about',
  'as','into','like','through','after','over','between','out','against',
  'during','without','before','under','around','among'
]);

const ORG_PATTERNS = [
  /\b(?:ООО|ОАО|ЗАО|ПАО|АО|НКО|Фонд|Ассоциация|Союз|Институт|Университет|Академия)\b[А-Яа-яЁё\s"«»\-\.]{2,60}/g,
  /\b(?:NATO|UN|USA|EU|CNN|BBC|Reuters|AP|AFP|ISIL|ISIS|OPEC|IAEA|WHO|WTO|ICC|FBI|CIA|NSA|DHS)\b/g,
  /\b(?:Министерство|Департамент|Управление|Служба|Агентство|Комитет|Комиссия)[А-Яа-яЁё\s"«»\-\.]{2,80}/g,
  /\b(?:Ministry|Department|Agency|Bureau|Service|Committee|Commission)[A-Za-z\s\-\.]{2,80}/g,
  /\b(?:Газпром|Роснефть|Лукойл|Сбербанк|ВТБ|Яндекс|Google|Apple|Microsoft|Amazon|Meta|Tesla|SpaceX|Boeing|Airbus|Lockheed|Raytheon|Northrop|BAE\s+Systems)\b/g,
];

const LOC_PATTERNS = [
  /\b(?:Москва|Санкт-Петербург|СПб|Петербург|Киев|Минск|Вашингтон|Лондон|Париж|Берлин|Брюссель|Женева|Вена|Варшава|Прага|Будапешт|Бухарест|София|Афины|Анкара|Стамбул|Тель-Авив|Иерусалим|Бейрут|Дамаск|Тегеран|Багдад|Эр-Рияд|Доха|Кабул|Исламабад|Дели|Пекин|Токио|Сеул|Тайбэй|Манила|Ханой|Джакарта|Каир|Абуджа|Аддис-Абеба|Претория|Кампала|Хартум)\b/g,
  /\b(?:Kyiv|Moscow|Washington|London|Paris|Berlin|Brussels|Geneva|Vienna|Warsaw|Prague|Budapest|Bucharest|Sofia|Athens|Ankara|Istanbul|Tel\s+Aviv|Jerusalem|Beirut|Damascus|Tehran|Baghdad|Riyadh|Doha|Kabul|Islamabad|Delhi|Beijing|Tokyo|Seoul|Taipei|Manila|Hanoi|Jakarta|Cairo|Pretoria)\b/g,
];

const DATE_PATTERNS = [
  /\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\b\s*(\d{4})?/gi,
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})?\b/gi,
  /\b(\d{4})-(\d{2})-(\d{2})\b/g,
  /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g,
];

const THREAT_KEYWORDS = {
  military: ['война','военный','армия','наступление','обстрел','бомбардировка','удар','ракета','обороно','вооружён',
    'war','military','army','offensive','bombardment','strike','missile','attack','armed','troops','invasion'],
  terrorism: ['теракт','террорист','взрыв','захват','заложник','радикал','экстремист','боевик',
    'terror','explosion','hostage','radical','extremist','militant','insurgent'],
  cyber: ['кибер','хакер','атака','взлом','уязвимость','инцидент','кража данных','вирус','вредонос',
    'cyber','hack','breach','vulnerability','malware','ransomware','phishing','ddos'],
  economic: ['санкции','эмбарго','дефолт','инфляция','кризис','обвал','рецессия','банкротство','торговая война',
    'sanctions','embargo','default','inflation','crisis','crash','recession','bankrupt','trade war'],
  political: ['переворот','отставка','импичмент','выборы','протест','митинг','забастовка','оппозиция',
    'coup','resignation','impeachment','election','protest','rally','strike','opposition'],
  disaster: ['землетрясение','наводнение','пожар','цунами','ураган','извержение','авария','катастрофа',
    'earthquake','flood','fire','tsunami','hurricane','eruption','disaster','accident'],
};

function normalize(text) {
  return text.replace(/[«»""'']/g, '"').replace(/\s+/g, ' ').trim();
}

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^\p{L}\s\-]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

export function extractEntities(text, opts = {}) {
  const norm = normalize(text);
  const lower = norm.toLowerCase();
  const entities = { persons: [], organizations: [], locations: [], dates: [], keywords: [] };
  const sources = [];
  let m;

  const personRe = /([А-ЯЁ][а-яё]+(?:[въ]ич|на|ов|ин|ев|ский|цкий|ая|ын)){0,1}\s+[А-ЯЁ][а-яё]+(?:[въ]ич|ов|ин|ев|ский|цкий|ая|ина|ын|овна|евич|ович)/g;
  while ((m = personRe.exec(norm)) !== null) {
    const name = m[0].trim();
    if (name.length > 5 && !STOP_WORDS.has(name.toLowerCase())) {
      entities.persons.push(name);
      sources.push({ type: 'person', value: name, start: m.index });
    }
  }
  const personEnRe = /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g;
  while ((m = personEnRe.exec(norm)) !== null) {
    const name = m[0];
    if (!STOP_WORDS.has(name.toLowerCase()) && name.length > 5) {
      entities.persons.push(name);
      sources.push({ type: 'person', value: name, start: m.index });
    }
  }

  for (const re of ORG_PATTERNS) {
    while ((m = re.exec(norm)) !== null) {
      const org = m[0].trim();
      if (org.length > 2) {
        entities.organizations.push(org);
        sources.push({ type: 'organization', value: org, start: m.index });
      }
    }
  }

  for (const re of LOC_PATTERNS) {
    while ((m = re.exec(norm)) !== null) {
      const loc = m[0].trim();
      if (loc.length > 2) {
        entities.locations.push(loc);
        sources.push({ type: 'location', value: loc, start: m.index });
      }
    }
  }

  for (const re of DATE_PATTERNS) {
    while ((m = re.exec(norm)) !== null) {
      const date = m[0].trim();
      entities.dates.push(date);
      sources.push({ type: 'date', value: date, start: m.index });
    }
  }

  const tokens = tokenize(norm);
  const freq = new Map();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  entities.keywords = sorted.slice(0, 15).map(([word, count]) => ({ word, count }));

  const threatScore = {};
  let totalThreat = 0;
  for (const [cat, words] of Object.entries(THREAT_KEYWORDS)) {
    let catScore = 0;
    for (const w of words) {
      const lw = w.toLowerCase();
      if (lower.includes(lw)) {
        catScore += (lower.split(lw).length - 1);
        totalThreat += 1;
      }
    }
    threatScore[cat] = catScore;
  }

  entities.persons = [...new Set(entities.persons)].slice(0, 20);
  entities.organizations = [...new Set(entities.organizations)].slice(0, 20);
  entities.locations = [...new Set(entities.locations)].slice(0, 20);
  entities.dates = [...new Set(entities.dates)].slice(0, 10);

  return {
    entities,
    threatScore: { ...threatScore, total: totalThreat },
    sentiment: totalThreat > 3 ? 'negative' : 'neutral',
    sources: sources.slice(0, 100),
  };
}

export async function extractFromBatch(items, opts = {}) {
  const results = new Map();
  const concurrency = opts.concurrency || 4;
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const current = idx++;
      const item = items[current];
      const text = item.title + ' ' + (item.description || item.summary || item.content || '');
      const id = item.id || item.guid || item.link || String(current);
      try {
        results.set(id, extractEntities(text, opts));
      } catch (e) {
        results.set(id, { error: e.message, entities: {}, threatScore: { total: 0 }, sentiment: 'unknown' });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export default { extractEntities, extractFromBatch };
