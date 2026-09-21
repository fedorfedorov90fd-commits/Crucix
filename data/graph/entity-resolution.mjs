#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  entity-resolution.mjs — Entity Resolution Engine  ·  v4
//  Crucix / data/graph/
//
//  Уровень: production. Архитектура по образцу Senzing v4 + OpenSanctions.
//
//  Компоненты:
//    1. Feature extraction — разбор записи на фичи
//    2. Candidate selection — blocking (4 ключа, UNION)
//    3. Feature comparison — purpose-built comparators
//       · Country code normalizer (ISO-3166-1 alpha-3 → полное имя)
//       · Stemming для Event (Battle ⟷ Battles)
//       · Anti-merge правила (United X ≠ United Y)
//       · Domain comparator (aa.com.tr ≠ aksam.com.tr)
//       · Location exact-only для известных стран (Nigeria ≠ Niger)
//    4. Scoring — weighted / Fellegi-Sunter
//    5. Decision — autoMerge / review / new
//    6. Relationship detection — co-occurrence + структурные связи
//    7. Full attribution — sources[] на узле, provenance[] на ребре
//
//  Только встроенные модули Node.js.
// ═══════════════════════════════════════════════════════════════════════

import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────
//  КОНФИГУРАЦИЯ
// ─────────────────────────────────────────────────────────────────────

export const THRESHOLDS = {
  autoMerge: 0.90,
  review: 0.70,
  domainAutoMerge: 0.95,
};

export const WEIGHTS = {
  jw: 2.0,
  lev: 1.0,
  dice: 1.0,
  soundex: 1.0,
};
export const WEIGHT_SUM = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

export const ABBREV_BOOST = 0.95;

export const BLOCKING_MAX_SIZE = 500;
export const BLOCKING_SKIP_OVERSIZED = true;

export const TYPE_HIERARCHY = {
  company: 'Organization',
  person: 'Actor',
  individual: 'Actor',
  group: 'Organization',
  vessel: 'Asset',
  aircraft: 'Asset',
  document: 'Document',
  organization: 'Organization',
  location: 'Location',
  event: 'Event',
};

export const STOP_WORDS = new Set([
  'of', 'the', 'and', 'for', 'in', 'at', 'on', 'to', 'a', 'an',
  'de', 'la', 'el', 'al',
]);

export const FS_PARAMS = {
  name:    { m: 0.90, u: 0.01 },
  country: { m: 0.95, u: 0.05 },
  address: { m: 0.90, u: 0.001 },
  type:    { m: 0.99, u: 0.10 },
};

// Двухуровневые TLD: последние два сегмента = TLD, base = 3-й с конца
export const MULTI_LEVEL_TLD = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk',
  'com.tr', 'org.tr', 'net.tr', 'gov.tr',
  'com.cn', 'org.cn', 'net.cn', 'gov.cn',
  'com.au', 'org.au', 'net.au',
  'co.jp', 'or.jp', 'ne.jp', 'go.jp',
  'co.kr', 'or.kr', 'go.kr',
  'com.br', 'org.br', 'net.br',
  'com.mx', 'com.ar', 'com.co', 'com.pe', 'com.ve',
  'co.in', 'org.in', 'net.in',
  'com.tw', 'org.tw', 'net.tw',
  'com.hk', 'com.sg', 'com.my', 'com.ph', 'com.vn',
  'co.za', 'co.id', 'co.nz',
  'com.eg', 'com.sa', 'com.ae',
]);

// ─────────────────────────────────────────────────────────────────────
//  ISO-3166-1 alpha-3 → полное название страны
// ─────────────────────────────────────────────────────────────────────

export const ISO_TO_COUNTRY = {
  AFG: 'Afghanistan', ALB: 'Albania', DZA: 'Algeria', AND: 'Andorra',
  AGO: 'Angola', ATG: 'Antigua and Barbuda', ARG: 'Argentina',
  ARM: 'Armenia', AUS: 'Australia', AUT: 'Austria', AZE: 'Azerbaijan',
  BHS: 'Bahamas', BHR: 'Bahrain', BGD: 'Bangladesh', BRB: 'Barbados',
  BLR: 'Belarus', BEL: 'Belgium', BLZ: 'Belize', BEN: 'Benin',
  BTN: 'Bhutan', BOL: 'Bolivia', BIH: 'Bosnia and Herzegovina',
  BWA: 'Botswana', BRA: 'Brazil', BRN: 'Brunei', BGR: 'Bulgaria',
  BFA: 'Burkina Faso', BDI: 'Burundi', KHM: 'Cambodia', CMR: 'Cameroon',
  CAN: 'Canada', CPV: 'Cape Verde', CAF: 'Central African Republic',
  TCD: 'Chad', CHL: 'Chile', CHN: 'China', COL: 'Colombia',
  COM: 'Comoros', COG: 'Republic of the Congo',
  COD: 'Democratic Republic of the Congo', CRI: 'Costa Rica',
  CIV: 'Ivory Coast', HRV: 'Croatia', CUB: 'Cuba', CYP: 'Cyprus',
  CZE: 'Czech Republic', DNK: 'Denmark', DJI: 'Djibouti',
  DMA: 'Dominica', DOM: 'Dominican Republic', ECU: 'Ecuador',
  EGY: 'Egypt', SLV: 'El Salvador', GNQ: 'Equatorial Guinea',
  ERI: 'Eritrea', EST: 'Estonia', ETH: 'Ethiopia', FJI: 'Fiji',
  FIN: 'Finland', FRA: 'France', GAB: 'Gabon', GMB: 'Gambia',
  GEO: 'Georgia', DEU: 'Germany', GHA: 'Ghana', GRC: 'Greece',
  GRD: 'Grenada', GTM: 'Guatemala', GIN: 'Guinea',
  GNB: 'Guinea-Bissau', GUY: 'Guyana', HTI: 'Haiti', HND: 'Honduras',
  HUN: 'Hungary', ISL: 'Iceland', IND: 'India', IDN: 'Indonesia',
  IRN: 'Iran', IRQ: 'Iraq', IRL: 'Ireland', ISR: 'Israel',
  ITA: 'Italy', JAM: 'Jamaica', JPN: 'Japan', JOR: 'Jordan',
  KAZ: 'Kazakhstan', KEN: 'Kenya', KIR: 'Kiribati', PRK: 'North Korea',
  KOR: 'South Korea', KWT: 'Kuwait', KGZ: 'Kyrgyzstan', LAO: 'Laos',
  LVA: 'Latvia', LBN: 'Lebanon', LSO: 'Lesotho', LBR: 'Liberia',
  LBY: 'Libya', LIE: 'Liechtenstein', LTU: 'Lithuania',
  LUX: 'Luxembourg', MKD: 'North Macedonia', MDG: 'Madagascar',
  MWI: 'Malawi', MYS: 'Malaysia', MDV: 'Maldives', MLI: 'Mali',
  MLT: 'Malta', MHL: 'Marshall Islands', MRT: 'Mauritania',
  MUS: 'Mauritius', MEX: 'Mexico', FSM: 'Micronesia', MDA: 'Moldova',
  MCO: 'Monaco', MNG: 'Mongolia', MNE: 'Montenegro', MAR: 'Morocco',
  MOZ: 'Mozambique', MMR: 'Myanmar', NAM: 'Namibia', NRU: 'Nauru',
  NPL: 'Nepal', NLD: 'Netherlands', NZL: 'New Zealand',
  NIC: 'Nicaragua', NER: 'Niger', NGA: 'Nigeria', NOR: 'Norway',
  OMN: 'Oman', PAK: 'Pakistan', PLW: 'Palau', PSE: 'Palestine',
  PAN: 'Panama', PNG: 'Papua New Guinea', PRY: 'Paraguay', PER: 'Peru',
  PHL: 'Philippines', POL: 'Poland', PRT: 'Portugal', QAT: 'Qatar',
  ROU: 'Romania', RUS: 'Russia', RWA: 'Rwanda',
  KNA: 'Saint Kitts and Nevis', LCA: 'Saint Lucia',
  VCT: 'Saint Vincent and the Grenadines', WSM: 'Samoa',
  SMR: 'San Marino', STP: 'Sao Tome and Principe',
  SAU: 'Saudi Arabia', SEN: 'Senegal', SRB: 'Serbia',
  SYC: 'Seychelles', SLE: 'Sierra Leone', SGP: 'Singapore',
  SVK: 'Slovakia', SVN: 'Slovenia', SLB: 'Solomon Islands',
  SOM: 'Somalia', ZAF: 'South Africa', SSD: 'South Sudan',
  ESP: 'Spain', LKA: 'Sri Lanka', SDN: 'Sudan', SUR: 'Suriname',
  SWZ: 'Eswatini', SWE: 'Sweden', CHE: 'Switzerland', SYR: 'Syria',
  TWN: 'Taiwan', TJK: 'Tajikistan', TZA: 'Tanzania', THA: 'Thailand',
  TLS: 'East Timor', TGO: 'Togo', TON: 'Tonga',
  TTO: 'Trinidad and Tobago', TUN: 'Tunisia', TUR: 'Turkey',
  TKM: 'Turkmenistan', TUV: 'Tuvalu', UGA: 'Uganda', UKR: 'Ukraine',
  ARE: 'United Arab Emirates', GBR: 'United Kingdom',
  USA: 'United States', URY: 'Uruguay', UZB: 'Uzbekistan',
  VUT: 'Vanuatu', VAT: 'Vatican City', VEN: 'Venezuela',
  VNM: 'Vietnam', YEM: 'Yemen', ZMB: 'Zambia', ZWE: 'Zimbabwe',
};

export const COUNTRY_TO_ISO = {};
for (const [iso, name] of Object.entries(ISO_TO_COUNTRY)) {
  COUNTRY_TO_ISO[normalizeName(name)] = iso;
}

// ─────────────────────────────────────────────────────────────────────
//  УТИЛИТЫ
// ─────────────────────────────────────────────────────────────────────

export function normalizeName(s) {
  if (!s || typeof s !== 'string') return '';
  return s.trim().toLowerCase()
    .replace(/-/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeType(type) {
  if (!type) return 'Entity';
  const lower = type.toLowerCase();
  if (TYPE_HIERARCHY[lower]) return TYPE_HIERARCHY[lower];
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

export function nowISO() {
  return new Date().toISOString();
}

export function round4(n) {
  return Math.round(n * 10000) / 10000;
}

export function makeEntityId(type, label) {
  const norm = normalizeName(label);
  if (!norm) return null;
  const hash = crypto.createHash('sha256')
    .update(`${type}:${norm}`).digest('hex').slice(0, 12);
  return `${type.toLowerCase()}:${hash}`;
}

// ─────────────────────────────────────────────────────────────────────
//  COUNTRY CODE NORMALIZER
// ─────────────────────────────────────────────────────────────────────

export function normalizeCountryCode(label) {
  if (!label || typeof label !== 'string') return label;
  const trimmed = label.trim();
  if (/^[A-Z]{3}$/.test(trimmed) && ISO_TO_COUNTRY[trimmed]) {
    return ISO_TO_COUNTRY[trimmed];
  }
  return label;
}

export function isKnownCountry(label) {
  if (!label || typeof label !== 'string') return false;
  return COUNTRY_TO_ISO[normalizeName(label)] !== undefined;
}

// ─────────────────────────────────────────────────────────────────────
//  STEMMING ДЛЯ EVENT
// ─────────────────────────────────────────────────────────────────────

export function applyStemming(label, type) {
  if (type !== 'Event') return label;
  if (!label || typeof label !== 'string') return label;
  const t = label.trim();
  if (t.length < 4) return t;
  if (t.endsWith('ies') && t.length > 4) {
    return t.slice(0, -3) + 'y';
  }
  if (t.endsWith('es') && t.length > 4) {
    const withoutEs = t.slice(0, -2);
    if (!withoutEs.endsWith('e')) return withoutEs;
  }
  if (t.endsWith('s') && !t.endsWith('ss') && t.length > 3) {
    return t.slice(0, -1);
  }
  return t;
}

// ─────────────────────────────────────────────────────────────────────
//  ANTI-MERGE ПРАВИЛА
// ─────────────────────────────────────────────────────────────────────

const ANTI_MERGE_PREFIXES = new Set([
  'united', 'republic', 'democratic', 'peoples', 'kingdom',
  'state', 'federal', 'national', 'central',
  'eastern', 'western', 'northern', 'southern',
  'islamic', 'arab', 'free', 'new', 'south', 'north',
]);

export function hasAntiMergeConflict(name1, name2) {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  if (!n1 || !n2 || n1 === n2) return false;

  const w1 = n1.split(' ');
  const w2 = n2.split(' ');

  // Найти общий стоп-префикс в начале обеих строк
  for (const prefix of ANTI_MERGE_PREFIXES) {
    if (w1[0] === prefix && w2[0] === prefix) {
      if (w1.length > 1 && w2.length > 1 && w1[1] !== w2[1]) {
        return true;
      }
    }
  }

  // «Republic of X» vs «Republic of Y»
  if (w1[0] === 'republic' && w1[1] === 'of' && w2[0] === 'republic' && w2[1] === 'of') {
    if (w1.length > 2 && w2.length > 2 && w1[2] !== w2[2]) {
      return true;
    }
  }

  // «X Y» vs «X Z» где X — значимый стоп-префикс (из первой позиции)
  if (w1.length >= 2 && w2.length >= 2) {
    if (ANTI_MERGE_PREFIXES.has(w1[0]) && w1[0] === w2[0] && w1[1] !== w2[1]) {
      return true;
    }
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────
//  DOMAIN COMPARATOR  (поддержка двухуровневых TLD)
// ─────────────────────────────────────────────────────────────────────

export function isDomain(label) {
  if (!label || typeof label !== 'string') return false;
  return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(label.trim());
}

/**
 * Разбивает домен на сегменты с учётом двухуровневых TLD.
 * Возвращает { sub: [...], base: string, tld: string }.
 * Для "aa.com.tr": sub = ['aa'], base = 'aa', tld = 'com.tr'.
 * Для "finance.yahoo.com": sub = ['finance'], base = 'yahoo', tld = 'com'.
 * Для "m.tech.china.com": sub = ['m','tech'], base = 'china', tld = 'com'.
 */
function parseDomain(domain) {
  const parts = domain.toLowerCase().trim().split('.').filter(Boolean);
  if (parts.length < 2) return null;

  // Проверяем, является ли последние два сегмента двухуровневым TLD
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_LEVEL_TLD.has(lastTwo) && parts.length >= 3) {
    return {
      sub: parts.slice(0, -3),
      base: parts[parts.length - 3],
      tld: lastTwo,
    };
  }

  return {
    sub: parts.slice(0, -2),
    base: parts[parts.length - 2],
    tld: parts[parts.length - 1],
  };
}

export function compareDomains(d1, d2) {
  const p1 = parseDomain(d1);
  const p2 = parseDomain(d2);
  if (!p1 || !p2) return 0;

  // Разные TLD → почти 0
  if (p1.tld !== p2.tld) return 0.1;

  // Разные базовые домены → низкий score (разные сайты)
  if (p1.base !== p2.base) return 0.2;

  // База совпадает: это поддомены одного сайта
  const sub1 = p1.sub.join('.');
  const sub2 = p2.sub.join('.');

  if (sub1 === sub2) return 1.0;      // точное совпадение
  if (!sub1 || !sub2) return 0.85;    // один — корень сайта, другой — поддомен
  return 0.7;                          // разные поддомены одного сайта
}

// ─────────────────────────────────────────────────────────────────────
//  STRING METRICS
// ─────────────────────────────────────────────────────────────────────

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const curr = [i + 1];
    for (let j = 0; j < b.length; j++) {
      curr[j + 1] = Math.min(
        prev[j + 1] + 1,
        curr[j] + 1,
        prev[j] + (a[i] === b[j] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

export function levenshteinNorm(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return 1 - levenshtein(a, b) / maxLen;
}

export function jaroSimilarity(s1, s2) {
  if (s1 === s2) return 1.0;
  const l1 = s1.length, l2 = s2.length;
  if (l1 === 0 || l2 === 0) return 0.0;
  const matchDist = Math.max(0, Math.floor(Math.max(l1, l2) / 2) - 1);
  const s1m = new Array(l1).fill(false);
  const s2m = new Array(l2).fill(false);
  let matches = 0;
  for (let i = 0; i < l1; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, l2);
    for (let j = start; j < end; j++) {
      if (!s2m[j] && s1[i] === s2[j]) {
        s1m[i] = true; s2m[j] = true; matches++; break;
      }
    }
  }
  if (matches === 0) return 0.0;
  let k = 0, transpositions = 0;
  for (let i = 0; i < l1; i++) {
    if (s1m[i]) {
      while (!s2m[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
  }
  transpositions = Math.floor(transpositions / 2);
  return (matches / l1 + matches / l2 + (matches - transpositions) / matches) / 3;
}

export function jaroWinkler(s1, s2, p = 0.1) {
  const j = jaroSimilarity(s1, s2);
  let prefix = 0;
  for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
    if (s1[i] === s2[i]) prefix++; else break;
  }
  return j + prefix * p * (1 - j);
}

export function soundex(s) {
  s = s.toUpperCase().trim();
  if (!s) return '0000';
  const codes = {
    B:'1',F:'1',P:'1',V:'1',
    C:'2',G:'2',J:'2',K:'2',Q:'2',S:'2',X:'2',Z:'2',
    D:'3',T:'3',L:'4',M:'5',N:'5',R:'6',
  };
  let result = s[0];
  let prev = codes[s[0]] || '0';
  for (let i = 1; i < s.length; i++) {
    const code = codes[s[i]] || '0';
    if (code !== '0' && code !== prev) result += code;
    prev = code;
  }
  result = result.replace(/0/g, '');
  return (result + '0000').slice(0, 4);
}

export function bigrams(s) {
  const set = new Set();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}

export function diceCoefficient(s1, s2) {
  const bg1 = bigrams(s1), bg2 = bigrams(s2);
  if (bg1.size === 0 && bg2.size === 0) return 1.0;
  if (bg1.size === 0 || bg2.size === 0) return 0.0;
  let intersection = 0;
  for (const bg of bg1) if (bg2.has(bg)) intersection++;
  return (2 * intersection) / (bg1.size + bg2.size);
}

// ─────────────────────────────────────────────────────────────────────
//  ABBREVIATION BLOCKER
// ─────────────────────────────────────────────────────────────────────

export function isAcronymOf(shortOriginal, longOriginal) {
  const shortUpper = [...shortOriginal].filter(c => c >= 'A' && c <= 'Z').join('');
  if (shortUpper.length < 2) return false;
  const words = longOriginal.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
  const initials = words
    .filter(w => w.length > 1 && !STOP_WORDS.has(w.toLowerCase()))
    .map(w => w[0].toUpperCase())
    .join('');
  if (initials.length < 2) return false;
  return shortUpper === initials;
}

export function isAbbreviationPair(name1Original, name2Original) {
  return isAcronymOf(name1Original, name2Original)
      || isAcronymOf(name2Original, name1Original);
}

// ─────────────────────────────────────────────────────────────────────
//  COMPOSITE SCORING  ·  порядок: anti-merge → exact → domain → location → fuzzy
// ─────────────────────────────────────────────────────────────────────

export function compositeScore(name1Original, name2Original, type = null) {
  // Нормализация label по типу
  let l1 = name1Original;
  let l2 = name2Original;
  if (type === 'Location') {
    l1 = normalizeCountryCode(l1);
    l2 = normalizeCountryCode(l2);
  }
  if (type === 'Event') {
    l1 = applyStemming(l1, 'Event');
    l2 = applyStemming(l2, 'Event');
  }

  const n1 = normalizeName(l1);
  const n2 = normalizeName(l2);

  // Anti-merge — приоритет выше всего
  if (hasAntiMergeConflict(l1, l2)) {
    return {
      exact: 0.0, jw: 0.0, lev: 0.0, dice: 0.0, soundex: 0.0,
      composite: 0.0, abbrev: false, phase: 'anti_merge_blocked',
    };
  }

  // Location exact-only для известных стран
  if (type === 'Location') {
    const is1 = isKnownCountry(l1);
    const is2 = isKnownCountry(l2);
    if (is1 && is2 && n1 !== n2) {
      return {
        exact: 0.0, jw: 0.0, lev: 0.0, dice: 0.0, soundex: 0.0,
        composite: 0.0, abbrev: false, phase: 'location_exact_only',
      };
    }
  }

  // Exact gate
  if (n1 === n2) {
    return {
      exact: 1.0, jw: 1.0, lev: 1.0, dice: 1.0, soundex: 1.0,
      composite: 1.0, abbrev: false, phase: 'exact',
    };
  }

  // Domain comparator
  if (type === 'Organization' && isDomain(l1) && isDomain(l2)) {
    const dScore = compareDomains(l1, l2);
    return {
      exact: 0.0, jw: 0.0, lev: 0.0, dice: 0.0, soundex: 0.0,
      composite: round4(dScore), abbrev: false, phase: 'domain',
    };
  }

  // Weighted fuzzy
  const jw = jaroWinkler(n1, n2);
  const lev = levenshteinNorm(n1, n2);
  const dice = diceCoefficient(n1, n2);
  const snd = soundex(n1) === soundex(n2) ? 1.0 : 0.0;

  let score = (
    WEIGHTS.jw * jw +
    WEIGHTS.lev * lev +
    WEIGHTS.dice * dice +
    WEIGHTS.soundex * snd
  ) / WEIGHT_SUM;

  const abbrev = isAbbreviationPair(name1Original, name2Original);
  if (abbrev) score = Math.max(score, ABBREV_BOOST);

  return {
    exact: 0.0,
    jw: round4(jw), lev: round4(lev), dice: round4(dice),
    soundex: snd, composite: round4(score),
    abbrev, phase: 'fuzzy',
  };
}

// ─────────────────────────────────────────────────────────────────────
//  FELLEGI-SUNTER
// ─────────────────────────────────────────────────────────────────────

export function fellegiSunterScore(nameComposite, props1, props2) {
  let logOdds = 0;
  const nameAgreement = nameComposite >= 0.85;
  const np = FS_PARAMS.name;
  logOdds += nameAgreement
    ? Math.log(np.m / np.u)
    : Math.log((1 - np.m) / (1 - np.u));

  for (const [key, params] of Object.entries(FS_PARAMS)) {
    if (key === 'name') continue;
    const v1 = props1?.[key];
    const v2 = props2?.[key];
    if (v1 === undefined || v2 === undefined) continue;
    const agree = normalizeName(v1) === normalizeName(v2);
    logOdds += agree
      ? Math.log(params.m / params.u)
      : Math.log((1 - params.m) / (1 - params.u));
  }
  return 1 / (1 + Math.exp(-logOdds));
}

// ─────────────────────────────────────────────────────────────────────
//  BLOCKING — 4 ключа, UNION
// ─────────────────────────────────────────────────────────────────────

export function buildBlockingKeys(originalName, normalizedName, typeName) {
  const keys = new Set();
  const words = normalizedName.split(' ').filter(w => w);

  const sigWords = words.filter(w => !STOP_WORDS.has(w));
  const firstWord = sigWords[0] || words[0] || normalizedName;
  if (firstWord) keys.add(`snd:${typeName}:${soundex(firstWord)}`);

  if (normalizedName.length >= 2) {
    keys.add(`pre:${typeName}:${normalizedName.slice(0, 3)}`);
  }

  if (words.length === 1 && words[0].length <= 5) {
    keys.add(`sinit:${typeName}:${[...words[0].toUpperCase()].sort().join('')}`);
  } else {
    const initials = words
      .filter(w => !STOP_WORDS.has(w))
      .map(w => w[0].toUpperCase());
    if (initials.length >= 1) {
      keys.add(`sinit:${typeName}:${initials.sort().join('')}`);
    }
  }

  const upper = [...originalName].filter(c => c >= 'A' && c <= 'Z').join('');
  if (upper.length >= 2 && upper.length <= 6) {
    keys.add(`acr:${typeName}:${[...upper].sort().join('')}`);
  } else {
    const origWords = originalName.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
    const initials = origWords
      .filter(w => w.length > 1 && !STOP_WORDS.has(w.toLowerCase()))
      .map(w => w[0].toUpperCase());
    if (initials.length >= 2) {
      keys.add(`acr:${typeName}:${initials.sort().join('')}`);
    }
  }

  return keys;
}

export class BlockingIndex {
  constructor() {
    this.blocks = new Map();
  }
  add(nodeId, blockingKeys) {
    for (const key of blockingKeys) {
      if (!this.blocks.has(key)) this.blocks.set(key, new Set());
      this.blocks.get(key).add(nodeId);
    }
  }
  getCandidates(blockingKeys) {
    const candidates = new Set();
    for (const key of blockingKeys) {
      const block = this.blocks.get(key);
      if (!block) continue;
      if (BLOCKING_SKIP_OVERSIZED && block.size > BLOCKING_MAX_SIZE) continue;
      for (const id of block) candidates.add(id);
    }
    return candidates;
  }
}

// ─────────────────────────────────────────────────────────────────────
//  ENTITY RESOLUTION ENGINE
// ─────────────────────────────────────────────────────────────────────

export class EntityResolutionEngine {
  constructor(options = {}) {
    this.scoringMode = options.scoringMode || 'weighted';
    this.nodes = new Map();
    this.edges = new Map();
    this.aliasIndex = new Map();
    this.typeIndex = new Map();
    this.blockingIndex = new BlockingIndex();
    this.reviewQueue = [];
    this.resolutionLog = [];
  }

  resolveEntity(rawType, label, sourceFile, itemProperties = {}) {
    const type = normalizeType(rawType);
    if (!label || typeof label !== 'string') return null;

    let normalizedLabel = label;
    if (type === 'Location') {
      normalizedLabel = normalizeCountryCode(label);
    }
    if (type === 'Event') {
      normalizedLabel = applyStemming(label, 'Event');
    }

    const normLabel = normalizeName(normalizedLabel);
    if (!normLabel) return null;

    // Phase 1: exact
    const aliasKey = `${type.toLowerCase()}:${normLabel}`;
    if (this.aliasIndex.has(aliasKey)) {
      const existingId = this.aliasIndex.get(aliasKey);
      this._updateExisting(existingId, normalizedLabel, sourceFile);
      this.resolutionLog.push({
        action: 'matched_exact', query: label, normalized: normLabel,
        resolved_to: existingId, source: sourceFile,
      });
      return { id: existingId, score: 1.0, action: 'exact' };
    }

    // Phase 2: blocking
    const blockingKeys = buildBlockingKeys(normalizedLabel, normLabel, type);
    const candidates = this.blockingIndex.getCandidates(blockingKeys);

    // Phase 3: scoring
    let bestMatch = null;
    let bestScore = 0;
    let bestBreakdown = null;

    for (const candidateId of candidates) {
      const candidate = this.nodes.get(candidateId);
      if (!candidate || candidate.type !== type) continue;

      const breakdown = compositeScore(normalizedLabel, candidate.label, type);
      let score = breakdown.composite;

      if (this.scoringMode === 'fellegi-sunter') {
        score = fellegiSunterScore(score, itemProperties, candidate.properties);
      }

      if (score > bestScore) {
        bestMatch = candidateId;
        bestScore = score;
        bestBreakdown = {
          ...breakdown,
          fs_score: this.scoringMode === 'fellegi-sunter' ? score : undefined,
        };
      }
    }

    // Phase 4: пороги
    const isDom = type === 'Organization'
      && isDomain(normalizedLabel)
      && bestMatch
      && isDomain(this.nodes.get(bestMatch).label);
    const autoMergeThreshold = isDom ? THRESHOLDS.domainAutoMerge : THRESHOLDS.autoMerge;

    if (bestMatch && bestScore >= autoMergeThreshold) {
      this._updateExisting(bestMatch, normalizedLabel, sourceFile);
      const node = this.nodes.get(bestMatch);
      this._mergeProperties(node, itemProperties);
      this.resolutionLog.push({
        action: 'matched_fuzzy_auto', query: label, normalized: normLabel,
        resolved_to: bestMatch, score: round4(bestScore),
        breakdown: bestBreakdown, source: sourceFile,
      });
      return { id: bestMatch, score: round4(bestScore), action: 'auto_merge' };
    }

    if (bestMatch && bestScore >= THRESHOLDS.review) {
      const existingNode = this.nodes.get(bestMatch);
      this.reviewQueue.push({
        entity1: { id: bestMatch, label: existingNode.label, type: existingNode.type },
        entity2: { label: normalizedLabel.trim(), type, normalized: normLabel },
        score: round4(bestScore),
        breakdown: bestBreakdown,
        source: sourceFile,
      });
      this.resolutionLog.push({
        action: 'review', query: label, normalized: normLabel,
        candidate: bestMatch, score: round4(bestScore),
        breakdown: bestBreakdown, source: sourceFile,
      });
      const newId = this._createNode(type, normalizedLabel, normLabel, aliasKey, blockingKeys, sourceFile, itemProperties);
      return { id: newId, score: round4(bestScore), action: 'review' };
    }

    const newId = this._createNode(type, normalizedLabel, normLabel, aliasKey, blockingKeys, sourceFile, itemProperties);
    return { id: newId, score: 1.0, action: 'new' };
  }

  _createNode(type, label, normLabel, aliasKey, blockingKeys, sourceFile, properties) {
    const id = makeEntityId(type, label);
    if (!id) return null;
    const node = {
      id, type, label: label.trim(), aliases: [],
      properties: { ...properties },
      sources: [sourceFile],
      first_seen: nowISO(), last_seen: nowISO(), mention_count: 1,
    };
    this.nodes.set(id, node);
    this.aliasIndex.set(aliasKey, id);
    if (!this.typeIndex.has(type)) this.typeIndex.set(type, new Set());
    this.typeIndex.get(type).add(id);
    this.blockingIndex.add(id, blockingKeys);
    this.resolutionLog.push({
      action: 'created_new', query: label, normalized: normLabel,
      new_id: id, source: sourceFile,
    });
    return id;
  }

  _updateExisting(id, label, sourceFile) {
    const node = this.nodes.get(id);
    if (!node) return;
    const cleanLabel = label.trim();
    if (!node.aliases.includes(cleanLabel)) node.aliases.push(cleanLabel);
    if (!node.sources.includes(sourceFile)) node.sources.push(sourceFile);
    node.last_seen = nowISO();
    node.mention_count = (node.mention_count || 1) + 1;
  }

  _mergeProperties(node, newProps) {
    for (const [key, val] of Object.entries(newProps)) {
      if (node.properties[key] === undefined) {
        node.properties[key] = val;
      } else if (node.properties[key] !== val) {
        if (!Array.isArray(node.properties[key])) {
          node.properties[key] = [node.properties[key]];
        }
        if (!node.properties[key].includes(val)) {
          node.properties[key].push(val);
        }
      }
    }
  }

  addEdge(sourceId, targetId, type, provenance) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const edgeKey = `${sourceId}|${targetId}|${type}`;
    if (this.edges.has(edgeKey)) {
      const edge = this.edges.get(edgeKey);
      edge.weight = (edge.weight || 1) + 1;
      edge.provenance.push(provenance);
    } else {
      this.edges.set(edgeKey, {
        id: `rel:${crypto.createHash('md5').update(edgeKey).digest('hex').slice(0, 10)}`,
        source: sourceId, target: targetId, type, weight: 1,
        provenance: [provenance],
      });
    }
  }

  toJSON() {
    return {
      meta: {
        generated_at: nowISO(),
        node_count: this.nodes.size,
        edge_count: this.edges.size,
        types: Object.fromEntries([...this.typeIndex.entries()].map(([t, s]) => [t, s.size])),
        scoring_mode: this.scoringMode,
        thresholds: THRESHOLDS,
        type_hierarchy: TYPE_HIERARCHY,
      },
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()],
    };
  }

  resolutionToJSON() {
    return {
      meta: {
        generated_at: nowISO(),
        total_resolutions: this.resolutionLog.length,
        unique_entities: this.nodes.size,
        review_queue_size: this.reviewQueue.length,
        auto_merges: this.resolutionLog.filter(r => r.action === 'matched_fuzzy_auto').length,
        exact_matches: this.resolutionLog.filter(r => r.action === 'matched_exact').length,
        new_entities: this.resolutionLog.filter(r => r.action === 'created_new').length,
        reviews: this.resolutionLog.filter(r => r.action === 'review').length,
      },
      aliases: [...this.nodes.values()].map(n => ({
        id: n.id, label: n.label, type: n.type, aliases: n.aliases,
      })),
      review_queue: this.reviewQueue,
      resolution_log: this.resolutionLog,
    };
  }

  provenanceToJSON() {
    const records = [];
    for (const edge of this.edges.values()) {
      for (const p of edge.provenance) {
        records.push({
          edge_id: edge.id, source_node: edge.source, target_node: edge.target,
          relation_type: edge.type, weight: edge.weight, ...p,
        });
      }
    }
    return {
      meta: { generated_at: nowISO(), total_provenance_records: records.length },
      records,
    };
  }
}
