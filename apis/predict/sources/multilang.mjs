// apis/sources/multilang.mjs
// Многоязычный NLP-конвейер: перевод, нормализация, культурно-специфический
// sentiment, детекция языковых аномалий.
//
// Теоретическая основа:
//   Liu, B. (2012). "Sentiment Analysis and Opinion Mining". Morgan & Claypool.
//   Balahur, A., & Turchi, M. (2014). "Comparative experiments using supervised
//   learning and machine translation for multilingual sentiment analysis".
//   Computer Speech & Language, 28(1), 56-75.
//   Zimbra, D., Abbasi, A., Zeng, D., & Chen, H. (2018). "The State-of-the-Art
//   in Twitter Sentiment Analysis". ACM TIST, 9(4), 1-38.
//
// Применение в Crucix:
//   30-й источник. Обработка GDELT-событий на 100+ языках.
//   Культурно-специфический sentiment для арабского, китайского,
//   корейского, фарси. Обнаружение языковых аномалий — внезапное
//   изменение тональности в региональных источниках.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// ЯЗЫКОВАЯ КОНФИГУРАЦИЯ
// ============================================================

const LANGUAGE_CONFIG = {
  zh: { name: 'Chinese',    sentimentModel: 'culture_specific', weight: 1.2, threatKeywords: ['战争', '威胁', '导弹', '军事'] },
  ar: { name: 'Arabic',     sentimentModel: 'culture_specific', weight: 1.2, threatKeywords: ['حرب', 'تهديد', 'صاروخ', 'عسكري'] },
  ko: { name: 'Korean',     sentimentModel: 'culture_specific', weight: 1.1, threatKeywords: ['전쟁', '위협', '미사일', '군사'] },
  fa: { name: 'Persian',    sentimentModel: 'culture_specific', weight: 1.1, threatKeywords: ['جنگ', 'تهدید', 'موشک', 'نظامی'] },
  ru: { name: 'Russian',    sentimentModel: 'standard',         weight: 1.0, threatKeywords: ['война', 'угроза', 'ракета', 'военн'] },
  en: { name: 'English',    sentimentModel: 'standard',         weight: 1.0, threatKeywords: ['war', 'threat', 'missile', 'military'] },
  es: { name: 'Spanish',    sentimentModel: 'standard',         weight: 0.9, threatKeywords: ['guerra', 'amenaza', 'misil', 'militar'] },
  fr: { name: 'French',     sentimentModel: 'standard',         weight: 0.9, threatKeywords: ['guerre', 'menace', 'missile', 'militaire'] },
  de: { name: 'German',     sentimentModel: 'standard',         weight: 0.9, threatKeywords: ['krieg', 'bedrohung', 'rakete', 'militär'] },
  ja: { name: 'Japanese',   sentimentModel: 'culture_specific', weight: 1.1, threatKeywords: ['戦争', '脅威', 'ミサイル', '軍事'] },
  tr: { name: 'Turkish',    sentimentModel: 'standard',         weight: 0.9, threatKeywords: ['savaş', 'tehdit', 'füze', 'askeri'] },
  he: { name: 'Hebrew',     sentimentModel: 'culture_specific', weight: 1.1, threatKeywords: ['מלחמה', 'איום', 'טיל', 'צבאי'] },
  hi: { name: 'Hindi',      sentimentModel: 'standard',         weight: 0.8, threatKeywords: ['युद्ध', 'धमकी', 'मिसाइल', 'सैन्य'] },
  ur: { name: 'Urdu',       sentimentModel: 'culture_specific', weight: 1.0, threatKeywords: ['جنگ', 'دھمکی', 'میزائل', 'فوجی'] },
};

// ============================================================
// ОПРЕДЕЛЕНИЕ ЯЗЫКА
// ============================================================

/**
 * Определение языка текста по Unicode-блокам.
 * Порядок проверок важен: zh → ja → ko → fa → ur → ar → he → ru → hi.
 * Персидский и урду проверяются ДО арабского — иначе они попадут в ar.
 */
function detectLanguage(text) {
  if (!text || text.length === 0) return 'en';

  const ranges = [
    { lang: 'zh', test: /[\u4e00-\u9fff]/u },
    { lang: 'ja', test: /[\u3040-\u309f\u30a0-\u30ff]/u },
    { lang: 'ko', test: /[\uac00-\ud7af]/u },
    // Персидский: арабский диапазон + характерные буквы پ چ گ ژ
    { lang: 'fa', test: /[\u0600-\u06ff][\u067e\u0686\u06af\u0698]/u },
    // Урду: арабский диапазон + характерные буквы ٹ ڈ ڑ ں
    { lang: 'ur', test: /[\u0600-\u06ff][\u0679\u0688\u0691\u06ba]/u },
    // Общий арабский — последним среди арабо-персидских
    { lang: 'ar', test: /[\u0600-\u06ff]/u },
    { lang: 'he', test: /[\u0590-\u05ff]/u },
    { lang: 'ru', test: /[\u0400-\u04ff]/u },
    { lang: 'hi', test: /[\u0900-\u097f]/u },
  ];

  for (const { lang, test } of ranges) {
    if (test.test(text)) return lang;
  }
  return 'en';
}

// ============================================================
// КУЛЬТУРНО-СПЕЦИФИЧЕСКИЙ SENTIMENT
// ============================================================

const SENTIMENT_LEXICONS = {
  ar: {
    positive: ['سلام', 'تعاون', 'اتفاق', 'نجاح', 'أمل', 'تقدم', 'ازدهار'],
    negative: ['حرب', 'صراع', 'تهديد', 'خطر', 'أزمة', 'عقوبات', 'عدوان'],
    intensifiers: ['جدا', 'كثيرا'],
    negators: ['لا', 'لم', 'لن', 'ليس', 'غير'],
  },
  zh: {
    positive: ['和平', '合作', '成功', '希望', '进步', '繁荣', '稳定'],
    negative: ['战争', '冲突', '威胁', '危险', '危机', '制裁', '侵略'],
    intensifiers: ['非常', '极其', '十分', '特别'],
    negators: ['不', '没', '无', '非', '未'],
  },
  ko: {
    positive: ['평화', '협력', '성공', '희망', '발전', '번영', '안정'],
    negative: ['전쟁', '갈등', '위협', '위험', '위기', '제재', '침략'],
    intensifiers: ['매우', '극히', '대단히', '특히'],
    negators: ['않', '없', '미', '불', '비'],
  },
  fa: {
    positive: ['صلح', 'همکاری', 'موفقیت', 'امید', 'پیشرفت', 'رشد', 'ثبات'],
    negative: ['جنگ', 'تنش', 'تهدید', 'خطر', 'بحران', 'تحریم', 'تهاجم'],
    intensifiers: ['بسیار', 'خیلی', 'شدید', 'بسیار زیاد'],
    negators: ['نه', 'نا', 'بی', 'عدم', 'غیر'],
  },
  en: {
    positive: ['peace', 'cooperation', 'success', 'hope', 'progress', 'prosperity', 'stability'],
    negative: ['war', 'conflict', 'threat', 'danger', 'crisis', 'sanctions', 'aggression'],
    intensifiers: ['very', 'extremely', 'highly', 'particularly'],
    negators: ['not', 'no', 'never', 'non', 'un'],
  },
  ru: {
    positive: ['мир', 'сотрудничество', 'успех', 'надежда', 'прогресс', 'процветание', 'стабильность'],
    negative: ['война', 'конфликт', 'угроза', 'опасность', 'кризис', 'санкции', 'агрессия'],
    intensifiers: ['очень', 'крайне', 'весьма', 'особенно'],
    negators: ['не', 'нет', 'ни', 'без', 'отсутствие'],
  },
  ja: {
    positive: ['平和', '協力', '成功', '希望', '進歩', '繁栄', '安定'],
    negative: ['戦争', '紛争', '脅威', '危険', '危機', '制裁', '侵略'],
    intensifiers: ['非常に', '極めて', 'とても'],
    negators: ['ない', 'なし', '非', '無', '未'],
  },
  he: {
    positive: ['שלום', 'שיתוף', 'הצלחה', 'תקווה', 'התקדמות', 'שגשוג', 'יציבות'],
    negative: ['מלחמה', 'סכסוך', 'איום', 'סכנה', 'משבר', 'סנקציות', 'תוקפנות'],
    intensifiers: ['מאוד', 'ביותר'],
    negators: ['לא', 'אין', 'בלתי'],
  },
  ur: {
    positive: ['امن', 'تعاون', 'کامیابی', 'امید', 'ترقی', 'خوشحالی', 'استحکام'],
    negative: ['جنگ', 'تنازع', 'دھمکی', 'خطر', 'بحران', 'پابندیاں', 'جارحیت'],
    intensifiers: ['بہت', 'انتہائی'],
    negators: ['نہیں', 'نہ', 'بے', 'عدم'],
  },
  es: {
    positive: ['paz', 'cooperación', 'éxito', 'esperanza', 'progreso', 'prosperidad', 'estabilidad'],
    negative: ['guerra', 'conflicto', 'amenaza', 'peligro', 'crisis', 'sanciones', 'agresión'],
    intensifiers: ['muy', 'extremadamente', 'altamente'],
    negators: ['no', 'nunca', 'sin'],
  },
  fr: {
    positive: ['paix', 'coopération', 'succès', 'espoir', 'progrès', 'prospérité', 'stabilité'],
    negative: ['guerre', 'conflit', 'menace', 'danger', 'crise', 'sanctions', 'agression'],
    intensifiers: ['très', 'extrêmement', 'hautement'],
    negators: ['pas', 'non', 'jamais', 'sans'],
  },
  de: {
    positive: ['frieden', 'zusammenarbeit', 'erfolg', 'hoffnung', 'fortschritt', 'wohlstand', 'stabilität'],
    negative: ['krieg', 'konflikt', 'bedrohung', 'gefahr', 'krise', 'sanktionen', 'aggression'],
    intensifiers: ['sehr', 'äußerst', 'höchst'],
    negators: ['nicht', 'kein', 'nie', 'ohne'],
  },
  tr: {
    positive: ['barış', 'işbirliği', 'başarı', 'umut', 'ilerleme', 'refah', 'istikrar'],
    negative: ['savaş', 'çatışma', 'tehdit', 'tehlike', 'kriz', 'yaptırımlar', 'saldırganlık'],
    intensifiers: ['çok', 'son derece', 'aşırı'],
    negators: ['değil', 'yok', 'asla', 'siz'],
  },
  hi: {
    positive: ['शांति', 'सहयोग', 'सफलता', 'आशा', 'प्रगति', 'समृद्धि', 'स्थिरता'],
    negative: ['युद्ध', 'संघर्ष', 'धमकी', 'खतरा', 'संकट', 'प्रतिबंध', 'आक्रामकता'],
    intensifiers: ['बहुत', 'अत्यंत', 'अधिक'],
    negators: ['नहीं', 'न', 'बिना', 'बिन'],
  },
};

/**
 * Вычисление sentiment с учётом культурной специфики.
 * Null-guard: text = null/undefined → пустая строка.
 */
function computeSentiment(text, lang) {
  const lex = SENTIMENT_LEXICONS[lang] || SENTIMENT_LEXICONS.en;
  const lower = (text || '').toLowerCase();
  const tokens = lower.split(/\s+/);

  let score = 0;
  let positiveHits = 0;
  let negativeHits = 0;
  let intensityMultiplier = 1;
  let negationActive = false;
  let negationWindow = 0;

  for (const token of tokens) {
    for (const inten of lex.intensifiers) {
      if (token.includes(inten)) { intensityMultiplier = 1.5; break; }
    }

    for (const neg of lex.negators) {
      if (token.includes(neg)) {
        negationActive = true;
        negationWindow = 3;
        break;
      }
    }

    for (const pos of lex.positive) {
      if (token.includes(pos)) {
        if (negationActive) { score -= intensityMultiplier; negativeHits++; }
        else { score += intensityMultiplier; positiveHits++; }
      }
    }

    for (const negWord of lex.negative) {
      if (token.includes(negWord)) {
        if (negationActive) { score += 0.5 * intensityMultiplier; positiveHits++; }
        else { score -= intensityMultiplier; negativeHits++; }
      }
    }

    if (negationWindow > 0) negationWindow--;
    else { negationActive = false; intensityMultiplier = 1; }
  }

  const maxPossible = Math.max(positiveHits + negativeHits, 1);
  const normalized = score / maxPossible;

  return {
    sentiment: Math.max(-1, Math.min(1, normalized)),
    positiveHits,
    negativeHits,
    language: lang,
    confidence: Math.min(1, (positiveHits + negativeHits) / 10),
  };
}

// ============================================================
// ОБНАРУЖЕНИЕ ЯЗЫКОВЫХ АНОМАЛИЙ
// ============================================================

/**
 * Детекция внезапного изменения тональности в региональных источниках.
 * Полная защита от отсутствующих полей через && — совместимо с любым Node.
 */
function detectLanguageAnomaly(history, lang, windowSize = 5) {
  const langEntries = (history || [])
    .map((h, i) => ({
      index: i,
      sentiment:
        (h && h.multilang && h.multilang[lang] && h.multilang[lang].avgSentiment) || 0,
      volume:
        (h && h.multilang && h.multilang[lang] && h.multilang[lang].eventCount) || 0,
    }))
    .filter((e) => e.volume > 0);

  if (langEntries.length < windowSize * 2) return { anomaly: false };

  const recent = langEntries.slice(-windowSize);
  const baseline = langEntries.slice(-windowSize * 2, -windowSize);

  const recentAvg = recent.reduce((s, e) => s + e.sentiment, 0) / recent.length;
  const baselineAvg = baseline.reduce((s, e) => s + e.sentiment, 0) / baseline.length;
  const recentVolume = recent.reduce((s, e) => s + e.volume, 0);
  const baselineVolume = baseline.reduce((s, e) => s + e.volume, 0);

  const sentimentShift = recentAvg - baselineAvg;
  const volumeSpike = recentVolume / Math.max(baselineVolume, 1);

  const isAnomaly =
    (sentimentShift < -0.3 && volumeSpike > 1.5) ||
    (sentimentShift > 0.3 && volumeSpike > 2.0);

  return {
    anomaly: isAnomaly,
    language: lang,
    sentimentShift,
    volumeSpike,
    recentAvg,
    baselineAvg,
    type: sentimentShift < 0 ? 'negative_shift' : 'positive_shift',
    severity: Math.min(1, Math.abs(sentimentShift) * Math.max(volumeSpike, 1)),
  };
}

// ============================================================
// ОБРАБОТКА СОБЫТИЙ
// ============================================================

/**
 * Обработка массива событий на разных языках.
 * Null-guard: events = null/undefined → пустой цикл.
 */
function processMultilingualEvents(events) {
  const byLanguage = {};

  for (const event of events || []) {
    const lang = detectLanguage(event.text || '');
    if (!byLanguage[lang]) {
      byLanguage[lang] = {
        language: lang,
        config: LANGUAGE_CONFIG[lang] || { name: lang, weight: 1.0 },
        events: [],
        sentiments: [],
        threatKeywordHits: 0,
      };
    }

    const sentiment = computeSentiment(event.text || '', lang);
    byLanguage[lang].events.push(event);
    byLanguage[lang].sentiments.push(sentiment.sentiment);

    const threatKw = (LANGUAGE_CONFIG[lang] || {}).threatKeywords || [];
    const lowerText = (event.text || '').toLowerCase();
    for (const kw of threatKw) {
      if (lowerText.includes(kw)) byLanguage[lang].threatKeywordHits++;
    }
  }

  const results = {};
  for (const [lang, data] of Object.entries(byLanguage)) {
    const sentiments = data.sentiments;
    const meanSentiment = sentiments.reduce((a, b) => a + b, 0) / Math.max(sentiments.length, 1);
    const sentimentStd = Math.sqrt(
      sentiments.reduce((s, v) => s + (v - meanSentiment) ** 2, 0) /
        Math.max(sentiments.length, 1)
    );

    results[lang] = {
      language: lang,
      name: data.config.name,
      eventCount: data.events.length,
      avgSentiment: meanSentiment,
      sentimentStd,
      threatKeywordHits: data.threatKeywordHits,
      weight: data.config.weight,
    };
  }

  return results;
}

// ============================================================
// ГЛАВНЫЙ ЦИКЛ
// ============================================================

/**
 * Главный модуль-источник: многоязычная обработка GDELT.
 * Полная защита от отсутствующих полей, try/catch вокруг записи.
 */
function processMultilingual(latest, history = []) {
  const events = (
    (latest && latest.gdelt && Array.isArray(latest.gdelt.rawEvents)
      ? latest.gdelt.rawEvents
      : [])
  )
    .map((e) => ({
      text: (e && (e.summary || e.description)) || '',
      source: 'gdelt',
      timestamp: (e && e.timestamp) || new Date().toISOString(),
    }))
    .filter((e) => e.text.length > 10);

  const byLanguage = processMultilingualEvents(events);

  const anomalies = [];
  for (const lang of Object.keys(byLanguage)) {
    const anomaly = detectLanguageAnomaly(history, lang);
    if (anomaly.anomaly) anomalies.push(anomaly);
  }

  const result = {
    timestamp: new Date().toISOString(),
    source: 'multilang',
    languageCount: Object.keys(byLanguage).length,
    byLanguage,
    anomalies,
    totalEvents: events.length,
    threatLevel:
      anomalies.length > 0
        ? Math.max(...anomalies.map((a) => a.severity))
        : 0,
  };

  try {
    const dir = join(__dirname, '..', '..', 'runs');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'multilang_latest.json'),
      JSON.stringify(result, null, 2)
    );
  } catch (e) {
    console.error('[multilang] write error:', e.message);
  }

  return result;
}

export {
  detectLanguage,
  computeSentiment,
  detectLanguageAnomaly,
  processMultilingualEvents,
  processMultilingual,
  LANGUAGE_CONFIG,
  SENTIMENT_LEXICONS,
};
