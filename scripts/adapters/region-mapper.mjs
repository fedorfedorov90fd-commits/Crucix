/**
 * region-mapper.mjs — геокодирование по словарю локаций
 * Версия 2.0.0 (20.09.2026). Расширенный словарь, центроиды стран, matchType.
 * Зависимости: ноль. Портабельно.
 *
 * Что изменилось относительно v1.0.0:
 *   - Добавлены центроиды стран (НЕ столицы) для матчей уровня "страна".
 *   - Добавлен matchType: 'city' | 'country' — позволяет отличать точное
 *     совпадение по городу от общего совпадения по стране.
 *   - Словарь городов расширен до ~150 крупнейших мировых городов.
 *   - Порядок матчинга: длинные ключи проверяются раньше коротких.
 */

// ─── Города ───
// matchType: 'city' — точные координаты города
const CITIES = [
  // Россия
  { key: 'москва', lat: 55.7558, lon: 37.6173, cc: 'RU', region: 'Москва' },
  { key: 'moscow', lat: 55.7558, lon: 37.6173, cc: 'RU', region: 'Москва' },
  { key: 'санкт-петербург', lat: 59.9343, lon: 30.3351, cc: 'RU', region: 'Санкт-Петербург' },
  { key: 'петербург', lat: 59.9343, lon: 30.3351, cc: 'RU', region: 'Санкт-Петербург' },
  { key: 'спб', lat: 59.9343, lon: 30.3351, cc: 'RU', region: 'Санкт-Петербург' },
  { key: 'st petersburg', lat: 59.9343, lon: 30.3351, cc: 'RU', region: 'Санкт-Петербург' },
  { key: 'новосибирск', lat: 55.0084, lon: 82.9357, cc: 'RU', region: 'Новосибирск' },
  { key: 'екатеринбург', lat: 56.8389, lon: 60.6057, cc: 'RU', region: 'Екатеринбург' },
  { key: 'нижний новгород', lat: 56.2965, lon: 43.9361, cc: 'RU', region: 'Нижний Новгород' },
  { key: 'казань', lat: 55.8304, lon: 49.0661, cc: 'RU', region: 'Казань' },
  { key: 'челябинск', lat: 55.1644, lon: 61.4368, cc: 'RU', region: 'Челябинск' },
  { key: 'омск', lat: 54.9893, lon: 73.3686, cc: 'RU', region: 'Омск' },
  { key: 'самара', lat: 53.2415, lon: 50.2217, cc: 'RU', region: 'Самара' },
  { key: 'ростов-на-дону', lat: 47.2357, lon: 39.7015, cc: 'RU', region: 'Ростов-на-Дону' },
  { key: 'уфа', lat: 54.7388, lon: 55.9721, cc: 'RU', region: 'Уфа' },
  { key: 'краснодар', lat: 45.0355, lon: 38.9753, cc: 'RU', region: 'Краснодар' },
  { key: 'воронеж', lat: 51.6608, lon: 39.2003, cc: 'RU', region: 'Воронеж' },
  { key: 'пермь', lat: 58.0105, lon: 56.2502, cc: 'RU', region: 'Пермь' },
  { key: 'волгоград', lat: 48.7080, lon: 44.5133, cc: 'RU', region: 'Волгоград' },
  { key: 'тамбов', lat: 52.7212, lon: 41.4523, cc: 'RU', region: 'Тамбов' },
  { key: 'тюмень', lat: 57.1522, lon: 65.5272, cc: 'RU', region: 'Тюмень' },
  { key: 'ярославль', lat: 57.6261, lon: 39.8845, cc: 'RU', region: 'Ярославль' },
  { key: 'иркутск', lat: 52.2978, lon: 104.1516, cc: 'RU', region: 'Иркутск' },
  { key: 'хабаровск', lat: 48.4726, lon: 135.0547, cc: 'RU', region: 'Хабаровск' },
  { key: 'владивосток', lat: 43.1198, lon: 131.8869, cc: 'RU', region: 'Владивосток' },
  { key: 'севастополь', lat: 44.4165, lon: 33.5817, cc: 'RU', region: 'Севастополь' },
  { key: 'симферополь', lat: 44.9521, lon: 34.1024, cc: 'RU', region: 'Симферополь' },
  { key: 'грозный', lat: 43.3179, lon: 45.6981, cc: 'RU', region: 'Грозный' },
  { key: 'мурманск', lat: 68.9585, lon: 33.0827, cc: 'RU', region: 'Мурманск' },
  { key: 'калининград', lat: 54.7054, lon: 20.4522, cc: 'RU', region: 'Калининград' },
  { key: 'сочи', lat: 43.6028, lon: 39.7342, cc: 'RU', region: 'Сочи' },
  { key: 'курск', lat: 51.7304, lon: 36.1926, cc: 'RU', region: 'Курск' },
  { key: 'белгород', lat: 50.5952, lon: 36.5872, cc: 'RU', region: 'Белгород' },
  { key: 'брянск', lat: 53.2434, lon: 34.3639, cc: 'RU', region: 'Брянск' },
  { key: 'тула', lat: 54.1961, lon: 37.6182, cc: 'RU', region: 'Тула' },
  // Украина
  { key: 'киев', lat: 50.4501, lon: 30.5234, cc: 'UA', region: 'Киев' },
  { key: 'kyiv', lat: 50.4501, lon: 30.5234, cc: 'UA', region: 'Киев' },
  { key: 'харьков', lat: 49.9935, lon: 36.2304, cc: 'UA', region: 'Харьков' },
  { key: 'kharkiv', lat: 49.9935, lon: 36.2304, cc: 'UA', region: 'Харьков' },
  { key: 'одесса', lat: 46.4825, lon: 30.7233, cc: 'UA', region: 'Одесса' },
  { key: 'днепр', lat: 48.4647, lon: 35.0462, cc: 'UA', region: 'Днепр' },
  { key: 'львов', lat: 49.8397, lon: 24.0297, cc: 'UA', region: 'Львов' },
  { key: 'запорожье', lat: 47.8388, lon: 35.1396, cc: 'UA', region: 'Запорожье' },
  { key: 'донецк', lat: 48.0159, lon: 37.8028, cc: 'UA', region: 'Донецк' },
  { key: 'луганск', lat: 48.5740, lon: 39.3074, cc: 'UA', region: 'Луганск' },
  { key: 'мариуполь', lat: 47.0951, lon: 37.5413, cc: 'UA', region: 'Мариуполь' },
  // Беларусь
  { key: 'минск', lat: 53.9006, lon: 27.5590, cc: 'BY', region: 'Минск' },
  { key: 'гомель', lat: 52.4345, lon: 30.9754, cc: 'BY', region: 'Гомель' },
  // Европа
  { key: 'лондон', lat: 51.5074, lon: -0.1278, cc: 'GB', region: 'Лондон' },
  { key: 'london', lat: 51.5074, lon: -0.1278, cc: 'GB', region: 'Лондон' },
  { key: 'париж', lat: 48.8566, lon: 2.3522, cc: 'FR', region: 'Париж' },
  { key: 'paris', lat: 48.8566, lon: 2.3522, cc: 'FR', region: 'Париж' },
  { key: 'берлин', lat: 52.5200, lon: 13.4050, cc: 'DE', region: 'Берлин' },
  { key: 'berlin', lat: 52.5200, lon: 13.4050, cc: 'DE', region: 'Берлин' },
  { key: 'брюссель', lat: 50.8503, lon: 4.3517, cc: 'BE', region: 'Брюссель' },
  { key: 'brussels', lat: 50.8503, lon: 4.3517, cc: 'BE', region: 'Брюссель' },
  { key: 'женева', lat: 46.2044, lon: 6.1432, cc: 'CH', region: 'Женева' },
  { key: 'geneva', lat: 46.2044, lon: 6.1432, cc: 'CH', region: 'Женева' },
  { key: 'вена', lat: 48.2082, lon: 16.3738, cc: 'AT', region: 'Вена' },
  { key: 'vienna', lat: 48.2082, lon: 16.3738, cc: 'AT', region: 'Вена' },
  { key: 'варшава', lat: 52.2297, lon: 21.0122, cc: 'PL', region: 'Варшава' },
  { key: 'warsaw', lat: 52.2297, lon: 21.0122, cc: 'PL', region: 'Варшава' },
  { key: 'прага', lat: 50.0755, lon: 14.4378, cc: 'CZ', region: 'Прага' },
  { key: 'prague', lat: 50.0755, lon: 14.4378, cc: 'CZ', region: 'Прага' },
  { key: 'рим', lat: 41.9028, lon: 12.4964, cc: 'IT', region: 'Рим' },
  { key: 'rome', lat: 41.9028, lon: 12.4964, cc: 'IT', region: 'Рим' },
  { key: 'мадрид', lat: 40.4168, lon: -3.7038, cc: 'ES', region: 'Мадрид' },
  { key: 'madrid', lat: 40.4168, lon: -3.7038, cc: 'ES', region: 'Мадрид' },
  { key: 'стокгольм', lat: 59.3293, lon: 18.0686, cc: 'SE', region: 'Стокгольм' },
  { key: 'хельсинки', lat: 60.1699, lon: 24.9384, cc: 'FI', region: 'Хельсинки' },
  { key: 'осло', lat: 59.9139, lon: 10.7522, cc: 'NO', region: 'Осло' },
  { key: 'копенгаген', lat: 55.6761, lon: 12.5683, cc: 'DK', region: 'Копенгаген' },
  { key: 'амстердам', lat: 52.3676, lon: 4.9041, cc: 'NL', region: 'Амстердам' },
  // Ближний Восток
  { key: 'анкара', lat: 39.9334, lon: 32.8597, cc: 'TR', region: 'Анкара' },
  { key: 'ankara', lat: 39.9334, lon: 32.8597, cc: 'TR', region: 'Анкара' },
  { key: 'стамбул', lat: 41.0082, lon: 28.9784, cc: 'TR', region: 'Стамбул' },
  { key: 'istanbul', lat: 41.0082, lon: 28.9784, cc: 'TR', region: 'Стамбул' },
  { key: 'тель-авив', lat: 32.0853, lon: 34.7818, cc: 'IL', region: 'Тель-Авив' },
  { key: 'tel aviv', lat: 32.0853, lon: 34.7818, cc: 'IL', region: 'Тель-Авив' },
  { key: 'иерусалим', lat: 31.7683, lon: 35.2137, cc: 'IL', region: 'Иерусалим' },
  { key: 'jerusalem', lat: 31.7683, lon: 35.2137, cc: 'IL', region: 'Иерусалим' },
  { key: 'бейрут', lat: 33.8938, lon: 35.5018, cc: 'LB', region: 'Бейрут' },
  { key: 'beirut', lat: 33.8938, lon: 35.5018, cc: 'LB', region: 'Бейрут' },
  { key: 'дамаск', lat: 33.5138, lon: 36.2765, cc: 'SY', region: 'Дамаск' },
  { key: 'damascus', lat: 33.5138, lon: 36.2765, cc: 'SY', region: 'Дамаск' },
  { key: 'тегеран', lat: 35.6892, lon: 51.3890, cc: 'IR', region: 'Тегеран' },
  { key: 'tehran', lat: 35.6892, lon: 51.3890, cc: 'IR', region: 'Тегеран' },
  { key: 'багдад', lat: 33.3152, lon: 44.3661, cc: 'IQ', region: 'Багдад' },
  { key: 'baghdad', lat: 33.3152, lon: 44.3661, cc: 'IQ', region: 'Багдад' },
  { key: 'эр-рияд', lat: 24.7136, lon: 46.6753, cc: 'SA', region: 'Эр-Рияд' },
  { key: 'riyadh', lat: 24.7136, lon: 46.6753, cc: 'SA', region: 'Эр-Рияд' },
  { key: 'доха', lat: 25.2854, lon: 51.5310, cc: 'QA', region: 'Доха' },
  { key: 'doha', lat: 25.2854, lon: 51.5310, cc: 'QA', region: 'Доха' },
  { key: 'дубай', lat: 25.2048, lon: 55.2708, cc: 'AE', region: 'Дубай' },
  { key: 'dubai', lat: 25.2048, lon: 55.2708, cc: 'AE', region: 'Дубай' },
  { key: 'каир', lat: 30.0444, lon: 31.2357, cc: 'EG', region: 'Каир' },
  { key: 'cairo', lat: 30.0444, lon: 31.2357, cc: 'EG', region: 'Каир' },
  // Азия
  { key: 'пекин', lat: 39.9042, lon: 116.4074, cc: 'CN', region: 'Пекин' },
  { key: 'beijing', lat: 39.9042, lon: 116.4074, cc: 'CN', region: 'Пекин' },
  { key: 'шанхай', lat: 31.2304, lon: 121.4737, cc: 'CN', region: 'Шанхай' },
  { key: 'shanghai', lat: 31.2304, lon: 121.4737, cc: 'CN', region: 'Шанхай' },
  { key: 'тайбэй', lat: 25.0330, lon: 121.5654, cc: 'TW', region: 'Тайбэй' },
  { key: 'taipei', lat: 25.0330, lon: 121.5654, cc: 'TW', region: 'Тайбэй' },
  { key: 'токио', lat: 35.6762, lon: 139.6503, cc: 'JP', region: 'Токио' },
  { key: 'tokyo', lat: 35.6762, lon: 139.6503, cc: 'JP', region: 'Токио' },
  { key: 'сеул', lat: 37.5665, lon: 126.9780, cc: 'KR', region: 'Сеул' },
  { key: 'seoul', lat: 37.5665, lon: 126.9780, cc: 'KR', region: 'Сеул' },
  { key: 'пхеньян', lat: 39.0392, lon: 125.7625, cc: 'KP', region: 'Пхеньян' },
  { key: 'pyongyang', lat: 39.0392, lon: 125.7625, cc: 'KP', region: 'Пхеньян' },
  { key: 'дели', lat: 28.7041, lon: 77.1025, cc: 'IN', region: 'Дели' },
  { key: 'delhi', lat: 28.7041, lon: 77.1025, cc: 'IN', region: 'Дели' },
  { key: 'мумбаи', lat: 19.0760, lon: 72.8777, cc: 'IN', region: 'Мумбаи' },
  { key: 'исламабад', lat: 33.6844, lon: 73.0479, cc: 'PK', region: 'Исламабад' },
  { key: 'кабул', lat: 34.5553, lon: 69.2075, cc: 'AF', region: 'Кабул' },
  { key: 'kabul', lat: 34.5553, lon: 69.2075, cc: 'AF', region: 'Кабул' },
  { key: 'ханой', lat: 21.0285, lon: 105.8542, cc: 'VN', region: 'Ханой' },
  { key: 'hanoi', lat: 21.0285, lon: 105.8542, cc: 'VN', region: 'Ханой' },
  { key: 'джакарта', lat: -6.2088, lon: 106.8456, cc: 'ID', region: 'Джакарта' },
  { key: 'jakarta', lat: -6.2088, lon: 106.8456, cc: 'ID', region: 'Джакарта' },
  // США
  { key: 'вашингтон', lat: 38.9072, lon: -77.0369, cc: 'US', region: 'Вашингтон' },
  { key: 'washington', lat: 38.9072, lon: -77.0369, cc: 'US', region: 'Вашингтон' },
  { key: 'нью-йорк', lat: 40.7128, lon: -74.0060, cc: 'US', region: 'Нью-Йорк' },
  { key: 'new york', lat: 40.7128, lon: -74.0060, cc: 'US', region: 'Нью-Йорк' },
  { key: 'лос-анджелес', lat: 34.0522, lon: -118.2437, cc: 'US', region: 'Лос-Анджелес' },
  { key: 'los angeles', lat: 34.0522, lon: -118.2437, cc: 'US', region: 'Лос-Анджелес' },
  { key: 'чикаго', lat: 41.8781, lon: -87.6298, cc: 'US', region: 'Чикаго' },
  { key: 'chicago', lat: 41.8781, lon: -87.6298, cc: 'US', region: 'Чикаго' },
];

// ─── Страны (центроиды, НЕ столицы) ───
// matchType: 'country' — грубая привязка к стране
// Координаты — географический центр страны, а не столица.
const COUNTRIES = [
  { key: 'россия', lat: 61.5240, lon: 105.3188, cc: 'RU', region: 'Россия' },
  { key: 'russia', lat: 61.5240, lon: 105.3188, cc: 'RU', region: 'Россия' },
  { key: 'украина', lat: 48.3794, lon: 31.1656, cc: 'UA', region: 'Украина' },
  { key: 'ukraine', lat: 48.3794, lon: 31.1656, cc: 'UA', region: 'Украина' },
  { key: 'сша', lat: 39.8283, lon: -98.5795, cc: 'US', region: 'США' },
  { key: 'usa', lat: 39.8283, lon: -98.5795, cc: 'US', region: 'США' },
  { key: 'китай', lat: 35.8617, lon: 104.1954, cc: 'CN', region: 'Китай' },
  { key: 'china', lat: 35.8617, lon: 104.1954, cc: 'CN', region: 'Китай' },
  { key: 'иран', lat: 32.4279, lon: 53.6880, cc: 'IR', region: 'Иран' },
  { key: 'iran', lat: 32.4279, lon: 53.6880, cc: 'IR', region: 'Иран' },
  { key: 'израиль', lat: 31.0461, lon: 34.8516, cc: 'IL', region: 'Израиль' },
  { key: 'israel', lat: 31.0461, lon: 34.8516, cc: 'IL', region: 'Израиль' },
  { key: 'сирия', lat: 34.8021, lon: 38.9968, cc: 'SY', region: 'Сирия' },
  { key: 'syria', lat: 34.8021, lon: 38.9968, cc: 'SY', region: 'Сирия' },
  { key: 'германия', lat: 51.1657, lon: 10.4515, cc: 'DE', region: 'Германия' },
  { key: 'germany', lat: 51.1657, lon: 10.4515, cc: 'DE', region: 'Германия' },
  { key: 'франция', lat: 46.2276, lon: 2.2137, cc: 'FR', region: 'Франция' },
  { key: 'france', lat: 46.2276, lon: 2.2137, cc: 'FR', region: 'Франция' },
  { key: 'великобритания', lat: 55.3781, lon: -3.4360, cc: 'GB', region: 'Великобритания' },
  { key: 'турция', lat: 38.9637, lon: 35.2433, cc: 'TR', region: 'Турция' },
  { key: 'turkey', lat: 38.9637, lon: 35.2433, cc: 'TR', region: 'Турция' },
  { key: 'индия', lat: 20.5937, lon: 78.9629, cc: 'IN', region: 'Индия' },
  { key: 'india', lat: 20.5937, lon: 78.9629, cc: 'IN', region: 'Индия' },
  { key: 'япония', lat: 36.2048, lon: 138.2529, cc: 'JP', region: 'Япония' },
  { key: 'japan', lat: 36.2048, lon: 138.2529, cc: 'JP', region: 'Япония' },
  { key: 'корея', lat: 35.9078, lon: 127.7669, cc: 'KR', region: 'Корея' },
  { key: 'korea', lat: 35.9078, lon: 127.7669, cc: 'KR', region: 'Корея' },
  { key: 'польша', lat: 51.9194, lon: 19.1451, cc: 'PL', region: 'Польша' },
  { key: 'poland', lat: 51.9194, lon: 19.1451, cc: 'PL', region: 'Польша' },
  { key: 'египет', lat: 26.8206, lon: 30.8025, cc: 'EG', region: 'Египет' },
  { key: 'egypt', lat: 26.8206, lon: 30.8025, cc: 'EG', region: 'Египет' },
  { key: 'саудовская аравия', lat: 23.8859, lon: 45.0792, cc: 'SA', region: 'Саудовская Аравия' },
  { key: 'saudi arabia', lat: 23.8859, lon: 45.0792, cc: 'SA', region: 'Саудовская Аравия' },
  { key: 'бразилия', lat: -14.2350, lon: -51.9253, cc: 'BR', region: 'Бразилия' },
  { key: 'brazil', lat: -14.2350, lon: -51.9253, cc: 'BR', region: 'Бразилия' },
  { key: 'австралия', lat: -25.2744, lon: 133.7751, cc: 'AU', region: 'Австралия' },
  { key: 'australia', lat: -25.2744, lon: 133.7751, cc: 'AU', region: 'Австралия' },
  { key: 'канада', lat: 56.1304, lon: -106.3468, cc: 'CA', region: 'Канада' },
  { key: 'canada', lat: 56.1304, lon: -106.3468, cc: 'CA', region: 'Канада' },
];

// Сортируем по длине ключа (длинные — вперёд, чтобы «Санкт-Петербург» матчился раньше «Петербург»).
CITIES.sort((a, b) => b.key.length - a.key.length);
COUNTRIES.sort((a, b) => b.key.length - a.key.length);

export function mapRegion(text) {
  const lower = (text || '').toLowerCase();
  // Сначала проверяем города — они точнее.
  for (const loc of CITIES) {
    if (lower.includes(loc.key)) {
      return {
        lat: loc.lat,
        lon: loc.lon,
        countryCode: loc.cc,
        region: loc.region,
        matchedLocation: loc.key,
        matchType: 'city',
        confidence: 0.9,
      };
    }
  }
  // Затем страны — грубая привязка.
  for (const loc of COUNTRIES) {
    if (lower.includes(loc.key)) {
      return {
        lat: loc.lat,
        lon: loc.lon,
        countryCode: loc.cc,
        region: loc.region,
        matchedLocation: loc.key,
        matchType: 'country',
        confidence: 0.5,
      };
    }
  }
  return null;
}

export function mapBatch(items) {
  const results = new Map();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const text = (item.title || '') + ' ' + (item.description || item.summary || item.content || '');
    const id = item.id || item.guid || item.link || String(i);
    const geo = mapRegion(text);
    if (geo) results.set(id, geo);
  }
  return results;
}

export default { mapRegion, mapBatch };
