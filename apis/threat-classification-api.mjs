/**
 * threat-classification-api.mjs — классификация уровня угрозы
 * Зависимости: ноль. Портабельно.
 */

const THREAT_RULES = [
  { category: 'military', weight: 5, words: ['война','вторжение','обстрел','бомбардировка','ракетный удар','наступление','авиаудар','artillery','bombing','invasion','airstrike','missile strike','offensive','ceasefire violation'] },
  { category: 'military', weight: 4, words: ['военный','армия','troops','military','armed forces','перемирие','эскалация','escalation'] },
  { category: 'terrorism', weight: 5, words: ['теракт','взрыв','заложник','захват заложников','terror attack','explosion','hostage','bombing','mass shooting','massacre'] },
  { category: 'terrorism', weight: 3, words: ['террорист','боевик','радикал','terrorist','militant','extremist','insurgent'] },
  { category: 'cyber', weight: 4, words: ['кибератака','взлом','data breach','ransomware','ddos','cyber attack','кража данных'] },
  { category: 'cyber', weight: 2, words: ['хакер','уязвимость','vulnerability','malware','phishing','инцидент безопасности'] },
  { category: 'economic', weight: 5, words: ['дефолт','обвал рынка','торговая война','trade war','market crash','default','economic collapse'] },
  { category: 'economic', weight: 4, words: ['санкции','эмбарго','инфляция','рецессия','sanctions','embargo','inflation','recession'] },
  { category: 'economic', weight: 3, words: ['кризис','обвал','банкротство','crisis','bankrupt','экономический спад'] },
  { category: 'political', weight: 5, words: ['переворот','coup','detat','государственный переворот','revolution','революция'] },
  { category: 'political', weight: 4, words: ['импичмент','отставка правительства','impeachment','government collapse','no confidence'] },
  { category: 'political', weight: 2, words: ['протест','митинг','забастовка','оппозиция','protest','rally','strike','opposition','election'] },
  { category: 'disaster', weight: 5, words: ['землетрясение','earthquake','цунами','tsunami','извержение вулкана','volcanic eruption'] },
  { category: 'disaster', weight: 4, words: ['наводнение','flood','ураган','hurricane','пожар','wildfire','авария на АЭС','nuclear accident'] },
  { category: 'disaster', weight: 3, words: ['катастрофа','авария','disaster','accident','техногенная'] },
];

export function classifyThreat(text, entitiesResult = null) {
  const lower = (text || '').toLowerCase();
  const scores = {};
  let totalScore = 0;
  const matchedRules = [];

  for (const rule of THREAT_RULES) {
    for (const word of rule.words) {
      const lw = word.toLowerCase();
      if (lower.includes(lw)) {
        const count = lower.split(lw).length - 1;
        const points = rule.weight * count;
        scores[rule.category] = (scores[rule.category] || 0) + points;
        totalScore += points;
        matchedRules.push({ category: rule.category, word, weight: rule.weight, count });
      }
    }
  }

  // Усиливаем от entity-extraction
  if (entitiesResult?.threatScore) {
    for (const [cat, val] of Object.entries(entitiesResult.threatScore)) {
      if (cat === 'total' || !val) continue;
      scores[cat] = (scores[cat] || 0) + val * 2;
      totalScore += val * 2;
    }
  }

  const categories = Object.entries(scores)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, score]) => ({ category: cat, score }));

  let level, recommendation;
  if (totalScore >= 15) { level = 'critical'; recommendation = 'alert'; }
  else if (totalScore >= 8) { level = 'high'; recommendation = 'alert'; }
  else if (totalScore >= 4) { level = 'medium'; recommendation = 'monitor'; }
  else if (totalScore >= 1) { level = 'low'; recommendation = 'monitor'; }
  else { level = 'none'; recommendation = 'skip'; }

  const confidence = Math.min(1, totalScore / 20);

  return { level, score: totalScore, categories, confidence, recommendation, matchedRules };
}

export async function classifyBatch(items, entitiesResults = null) {
  const results = new Map();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const text = item.title + ' ' + (item.description || item.summary || item.content || '');
    const id = item.id || item.guid || item.link || String(i);
    const ent = entitiesResults?.get(id) || null;
    results.set(id, classifyThreat(text, ent));
  }
  return results;
}

export default { classifyThreat, classifyBatch };
