/**
 * Интеллектуальный фильтр для оценки новостей
 *
 * Использует локальный ИИ (Ollama) для оценки релевантности
 * новостей заданной теме (геополитика, роботоиндустрия, и т.д.)
 */

export class AIFilter {
  constructor(topic = 'world-war-3') {
    this.topic = topic;
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
    this.ollamaModel = process.env.OLLAMA_MODEL || 'deepseek-r1:7b';

    this.topics = {
      'world-war-3': {
        name: 'Геополитика / 3-я мировая',
        keywords: ['война', 'атака', 'ракета', 'танк', 'армия', 'ядерный',
                   'конфликт', 'эскалация', 'вторжение', 'граница', 'санкция',
                   'военный', 'спецоперация', 'мобилизация', 'удар', 'обстрел',
                   'наступление', 'оборона', 'переговоры', 'ультиматум'],
        prompt: `Ты — военно-политический аналитик. Оцени новость по шкале от 0 до 10,
где 0 — не имеет отношения к началу 3-й мировой войны,
5 — косвенно связано (экономика, политика, но без военной угрозы),
8 — прямо связано (военные действия, эскалация, угрозы),
10 — критический сигнал (непосредственная подготовка к войне).

Ответь в формате:
ОЦЕНКА: число от 0 до 10
ОБОСНОВАНИЕ: кратко (1-2 предложения)`
      },
      'robotics': {
        name: 'Роботоиндустрия',
        keywords: ['робот', 'робототехника', 'дрон', 'автоматизация', 'AI',
                   'искусственный интеллект', 'нейросеть', 'бионика', 'экзоскелет',
                   'автопилот', 'беспилотник', 'андроид', 'киборг', 'манипулятор'],
        prompt: `Ты — аналитик роботоиндустрии. Оцени новость по шкале от 0 до 10,
где 0 — не имеет отношения к развитию робототехники,
5 — косвенно связано (инвестиции, регуляции, конференции),
8 — прямо связано (новые разработки, прорывы, внедрение),
10 — прорывное событие, меняющее индустрию.

Ответь в формате:
ОЦЕНКА: число от 0 до 10
ОБОСНОВАНИЕ: кратко (1-2 предложения)`
      },
      'biotech': {
        name: 'Биотехнологии',
        keywords: ['ген', 'биотех', 'лекарство', 'вакцина', 'генная инженерия',
                   'клетка', 'ДНК', 'РНК', 'иммунитет', 'вирус', 'бактерия',
                   'биохакинг', 'криптовалюта', 'биоинформатика', 'белок'],
        prompt: `Ты — аналитик биотехнологий. Оцени новость по шкале от 0 до 10,
где 0 — не имеет отношения к биотехнологиям,
5 — косвенно связано (финансирование, регуляции),
8 — прямо связано (новые открытия, клинические испытания),
10 — прорывное событие, меняющее отрасль.

Ответь в формате:
ОЦЕНКА: число от 0 до 10
ОБОСНОВАНИЕ: кратко (1-2 предложения)`
      },
      'cyber': {
        name: 'Кибербезопасность',
        keywords: ['хакер', 'атака', 'вирус', 'взлом', 'уязвимость', 'шифрование',
                   'кибер', 'фишинг', 'DDOS', 'ransomware', 'data breach',
                   'безопасность', 'сертификат', 'криптография', 'firewall'],
        prompt: `Ты — аналитик кибербезопасности. Оцени новость по шкале от 0 до 10,
где 0 — не имеет отношения к кибербезопасности,
5 — косвенно связано (новые законы, конференции),
8 — прямо связано (атаки, уязвимости, новые угрозы),
10 — критическая угроза глобального масштаба.

Ответь в формате:
ОЦЕНКА: число от 0 до 10
ОБОСНОВАНИЕ: кратко (1-2 предложения)`
      }
    };

    if (!this.topics[this.topic]) {
      this.topic = Object.keys(this.topics)[0];
    }
  }

  keywordFilter(items) {
    const keywords = this.topics[this.topic].keywords;
    const lowerKeywords = keywords.map(k => k.toLowerCase());

    return items.filter(item => {
      const text = (item.title + ' ' + item.summary + ' ' + (item.text || '')).toLowerCase();
      return lowerKeywords.some(kw => text.includes(kw));
    });
  }

  async scoreWithAI(item) {
    const text = (item.title || '') + '\n' + (item.summary || '') + '\n' + (item.text || '');
    const prompt = this.topics[this.topic].prompt + '\n\nНОВОСТЬ:\n' + text.slice(0, 2000);

    try {
      const response = await fetch(this.ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollamaModel,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 200,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama ошибка: ${response.status}`);
      }

      const data = await response.json();
      const result = data.response || '';

      const scoreMatch = result.match(/(?:ОЦЕНКА|Score|Оценка)[:\s]*(\d+)/i);
      const reasoningMatch = result.match(/(?:ОБОСНОВАНИЕ|Reasoning|Обоснование)[:\s]*(.+)/i);

      return {
        ...item,
        aiScore: scoreMatch ? Math.min(parseInt(scoreMatch[1]), 10) : 0,
        aiReasoning: reasoningMatch ? reasoningMatch[1].trim() : result.slice(0, 200),
        aiRaw: result,
      };
    } catch (error) {
      console.error('[AIFilter] Ошибка при оценке:', error.message);
      return {
        ...item,
        aiScore: 0,
        aiReasoning: 'Ошибка оценки',
        aiRaw: null,
      };
    }
  }

  async scoreBatch(items, batchSize = 5) {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => this.scoreWithAI(item))
      );
      results.push(...batchResults);
      console.log(`[AIFilter] Оценено ${Math.min(i + batchSize, items.length)}/${items.length}`);
    }
    return results;
  }

  async filter(items, options = {}) {
    const { minScore = 5, maxResults = 20, batchSize = 3 } = options;

    console.log(`[AIFilter] Тема: ${this.topics[this.topic].name}`);
    console.log(`[AIFilter] Всего новостей: ${items.length}`);

    let filtered = this.keywordFilter(items);
    console.log(`[AIFilter] После ключевых слов: ${filtered.length}`);

    if (filtered.length === 0) {
      return { items: [], summary: 'Нет новостей, соответствующих теме' };
    }

    const scored = await this.scoreBatch(filtered, batchSize);

    const sorted = scored
      .filter(item => item.aiScore >= minScore)
      .sort((a, b) => b.aiScore - a.aiScore);

    console.log(`[AIFilter] После AI-оценки: ${sorted.length}`);

    const topResults = sorted.slice(0, maxResults);
    const summary = this.generateSummary(topResults);

    return {
      items: topResults,
      summary: summary,
      totalFiltered: filtered.length,
      totalScored: scored.length,
      totalAccepted: sorted.length,
    };
  }

  generateSummary(items) {
    if (items.length === 0) {
      return 'Нет релевантных новостей';
    }

    const scores = items.map(i => i.aiScore || 0);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const topItem = items[0];

    let threatLevel = 'Низкий';
    if (avgScore > 7) threatLevel = 'Критический';
    else if (avgScore > 5) threatLevel = 'Повышенный';
    else if (avgScore > 3) threatLevel = 'Средний';

    let summary = `📊 СВОДКА ПО ТЕМЕ: ${this.topics[this.topic].name}\n`;
    summary += `   - Всего релевантных новостей: ${items.length}\n`;
    summary += `   - Средняя оценка: ${avgScore.toFixed(1)}/10\n`;
    summary += `   - Максимальная оценка: ${maxScore}/10\n`;
    summary += `   - Уровень угрозы/интереса: ${threatLevel}\n\n`;
    summary += `🔝 ТОП-1: ${topItem.title || 'Без заголовка'}\n`;
    summary += `   Оценка: ${topItem.aiScore}/10\n`;
    summary += `   Обоснование: ${topItem.aiReasoning || 'Нет обоснования'}\n`;

    return summary;
  }

  setTopic(topic) {
    if (this.topics[topic]) {
      this.topic = topic;
      console.log(`[AIFilter] Тема изменена на: ${this.topics[topic].name}`);
    } else {
      console.warn(`[AIFilter] Тема "${topic}" не найдена`);
    }
  }

  getAvailableTopics() {
    return Object.keys(this.topics).map(key => ({
      id: key,
      name: this.topics[key].name,
    }));
  }

  addTopic(id, name, keywords, prompt) {
    this.topics[id] = { name, keywords, prompt };
  }
}

export default new AIFilter();
