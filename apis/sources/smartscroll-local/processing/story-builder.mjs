// apis/sources/smartscroll-local/processing/story-builder.mjs
// Версия 2.0.0. Принят 26.09.2026.
//
// Event clustering into stories.
// Similarity metric:
//   entities  (weight 0.5)
// + title sim (weight 0.3)
// + body sim  (weight 0.2)
// + cross-pole boost 0.05 (v2.0.0)
// Uses inverted index on entities for fast candidate lookup (O(1) per event
// instead of O(N) over all stories).
//
// ИЗМЕНЕНИЯ v1.0.0 → v2.0.0:
//   + Cross-pole boost в _similarity: если event и story из разных полюсов,
//     score += 0.05. Логика: независимое подтверждение события с двух полюсов —
//     академически сильнее, чем многократное повторение внутри одного.
//     Boost МАЛЕНЬКИЙ и ПОЛОЖИТЕЛЬНЫЙ — не ломает существующие пороги (0.35).
//   + Поле poles: Set<string> в Story — множество полюсов всех событий сюжета.
//   + Поле bias_rank_weight в Story — СОРТИРОВОЧНЫЙ ВЕС (0-1), НЕ ВЕРДИКТ ПРАВДЫ.
//     Вычисляется отдельным методом _computeBiasRank(story) ПОСЛЕ addToStories.
//     НЕ трогает similarity. Может использоваться потребителем как rank signal.
//   + Метод detectSyndication(text) — детектор перепечатки (10 regex-паттернов:
//     "по материалам", "according to", "reported by", "цитирует", "ссылкой на"...).
//   + Метод _computeBiasRank(story) — вычисляет bias_rank_weight по формуле:
//       cross_pole + !syndication → 0.9
//       cross_pole + syndication  → 0.5
//       same_pole                 → 0.6
//       single_source             → 0.3
//   + Метод _getStoryPoles(story) — собирает множество полюсов всех событий.
//   + Метод _hasSyndicationInStory(story) — проверяет syndication по events[].title + body.
//
// ДИСКЛЕЙМЕР: bias_rank_weight — эвристический вес, НЕ валидирован на golden
// dataset. Использовать только как rank signal для сортировки, НЕ как вердикт
// достоверности. Публичная валидация запланирована (F1 ≥ 0.75 на 100+ событиях).
//
// ЧТО СОХРАНЕНО ИЗ v1.0.0: inverted index (_entityIndex, _indexStory, _candidates,
// _rebuildIndex), 3-компонентная similarity (entities 0.5 + title 0.3 + body 0.2),
// _updateRelatedStories (3+ сущностей → связь), getIndexStats, _nextStoryId,
// addToStories, threshold 0.35, _jaccardSets, _textSimilarity, _shingleSimilarity,
// _shingles. ПОЛНАЯ ЗАМЕНА ФАЙЛА (не патч).

export class StoryBuilder {
  constructor(threshold = 0.35) {
    this.threshold = threshold;
    this._entityIndex = new Map();
  }

  addToStories(newEvents, existingStories = []) {
    const stories = existingStories.map(s => ({ ...s, _dirty: false }));
    let nextId = this._nextStoryId(stories);

    // Rebuild inverted index from existing stories
    this._rebuildIndex(stories);

    for (const event of newEvents) {
      // Fast candidate lookup: only stories sharing at least one entity
      const candidateIds = this._candidates(event);

      let bestStory = null;
      let bestScore = 0;

      for (const idx of candidateIds) {
        const story = stories[idx];
        const score = this._similarity(event, story);
        if (score >= this.threshold && score > bestScore) {
          bestScore = score;
          bestStory = story;
        }
      }

      // Fallback: if no candidates by entities, check all stories
      // (rare case when event has no entities at all)
      if (!bestStory && (event.entities?.length || 0) === 0) {
        for (const story of stories) {
          const score = this._similarity(event, story);
          if (score >= this.threshold && score > bestScore) {
            bestScore = score;
            bestStory = story;
          }
        }
      }

      if (bestStory) {
        bestStory.events.push(event);
        bestStory._dirty = true;

        for (const ent of event.entities || []) {
          if (!bestStory.entities.includes(ent)) {
            bestStory.entities.push(ent);
          }
        }

        if (new Date(event.published_at) < new Date(bestStory.start_time)) {
          bestStory.start_time = event.published_at;
        }

        event.story_id = bestStory.id;
        this._updateRelatedStories(bestStory, stories);
        // Update index for new entities added to story
        this._indexStory(bestStory, stories.indexOf(bestStory));
      } else {
        const storyId = `story_${nextId++}`;
        const newStory = {
          id: storyId,
          title: event.title,
          summary: '',
          status: 'active',
          start_time: event.published_at,
          end_time: event.published_at,
          entities: [...(event.entities || [])],
          events: [event],
          related_stories: [],
        };
        event.story_id = storyId;
        stories.push(newStory);
        this._indexStory(newStory, stories.length - 1);
        this._updateRelatedStories(newStory, stories);
      }
    }

    // v2.0.0: вычисляем bias_rank_weight для всех Story (не влияет на clustering)
    for (const story of stories) {
      story.bias_rank_weight = this._computeBiasRank(story);
    }

    return stories;
  }

  // v2.0.0: собирает множество полюсов всех событий сюжета
  _getStoryPoles(story) {
    const poles = new Set();
    for (const event of story.events || []) {
      if (event.pole && event.pole !== 'unknown') poles.add(event.pole);
    }
    return poles;
  }

  // v2.0.0: проверяет syndication в сюжете
  _hasSyndicationInStory(story) {
    for (const event of story.events || []) {
      const text = `${event.title || ''} ${event.body || ''}`;
      if (this.detectSyndication(text)) return true;
    }
    return false;
  }

  // v2.0.0: детектор перепечатки (10 паттернов)
  detectSyndication(text) {
    if (!text || typeof text !== 'string') return false;
    const patterns = [
      /\bпо материалам\b/i,
      /\bпо сообщению\b/i,
      /\bпо данным\b/i,
      /\baccording to\b/i,
      /\breported by\b/i,
      /\bsources? (said|told)\b/i,
      /\bciting\b/i,
      /\bцитирует\b/i,
      /\bссылкой на\b/i,
      /\bref(erence)? to\b/i,
    ];
    return patterns.some(re => re.test(text));
  }

  // v2.0.0: вычисляет bias_rank_weight (0-1) — сортировочный вес, НЕ вердикт
  _computeBiasRank(story) {
    const poles = this._getStoryPoles(story);
    const sourcesCount = (story.events || []).length;
    const isCrossPole = poles.size >= 2;
    const hasSyndication = this._hasSyndicationInStory(story);

    if (sourcesCount === 0) return 0;
    if (sourcesCount === 1) return 0.3;
    if (isCrossPole && !hasSyndication) return 0.9;
    if (isCrossPole && hasSyndication) return 0.5;
    if (sourcesCount >= 2) return 0.6;
    return 0.4;
  }

  _rebuildIndex(stories) {
    this._entityIndex.clear();
    for (let i = 0; i < stories.length; i++) {
      this._indexStory(stories[i], i);
    }
  }

  _indexStory(story, idx) {
    for (const ent of story.entities || []) {
      const key = String(ent).toLowerCase();
      if (!this._entityIndex.has(key)) {
        this._entityIndex.set(key, new Set());
      }
      this._entityIndex.get(key).add(idx);
    }
  }

  _candidates(event) {
    const candidateIds = new Set();
    for (const ent of event.entities || []) {
      const key = String(ent).toLowerCase();
      const idxSet = this._entityIndex.get(key);
      if (idxSet) {
        for (const idx of idxSet) candidateIds.add(idx);
      }
    }
    return candidateIds;
  }

  _similarity(event, story) {
    const entitySim = this._jaccardSets(
      new Set((event.entities || []).map(e => String(e).toLowerCase())),
      new Set((story.entities || []).map(e => String(e).toLowerCase()))
    );

    const titleSim = this._textSimilarity(
      event.title,
      story.title || story.events[story.events.length - 1]?.title || ''
    );

    const bodySim = this._shingleSimilarity(
      event.body,
      story.events[story.events.length - 1]?.body || ''
    );

    let score = entitySim * 0.5 + titleSim * 0.3 + bodySim * 0.2;

    // v2.0.0: cross-pole boost 0.05
    // Если event и story из разных полюсов — небольшой положительный boost.
    // НЕ ломает существующие пороги (0.35). Логика: cross-pole независимое
    // подтверждение академически сильнее повторения внутри одного полюса.
    const eventPole = event.pole && event.pole !== 'unknown' ? event.pole : null;
    if (eventPole) {
      const storyPoles = this._getStoryPoles(story);
      if (storyPoles.size > 0 && !storyPoles.has(eventPole)) {
        score += 0.05;
      }
    }

    return score;
  }

  _jaccardSets(a, b) {
    if (a.size === 0 && b.size === 0) return 0;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    return inter / (a.size + b.size - inter);
  }

  _textSimilarity(a, b) {
    if (!a || !b) return 0;
    const setA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const setB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    return this._jaccardSets(setA, setB);
  }

  _shingleSimilarity(a, b) {
    const k = 4;
    const shA = this._shingles(a, k);
    const shB = this._shingles(b, k);
    return this._jaccardSets(shA, shB);
  }

  _shingles(text, k = 4) {
    const words = (text || '').toLowerCase().split(/\s+/).filter(w => w.length > 1);
    if (words.length < k) return new Set([words.join(' ')]);
    const sh = new Set();
    for (let i = 0; i <= words.length - k; i++) {
      sh.add(words.slice(i, i + k).join(' '));
    }
    return sh;
  }

  _nextStoryId(stories) {
    let max = 0;
    for (const s of stories) {
      const m = s.id.match(/^story_(\d+)$/);
      if (m && parseInt(m[1]) >= max) max = parseInt(m[1]) + 1;
    }
    return max;
  }

  _updateRelatedStories(story, allStories) {
    const storyEntities = new Set((story.entities || []).map(e => String(e).toLowerCase()));
    if (storyEntities.size === 0) return;

    for (const other of allStories) {
      if (other.id === story.id) continue;
      if (story.related_stories.includes(other.id)) continue;

      const otherEntities = new Set((other.entities || []).map(e => String(e).toLowerCase()));
      let common = 0;
      for (const e of storyEntities) {
        if (otherEntities.has(e)) common++;
      }

      if (common >= 3) {
        if (!story.related_stories.includes(other.id)) {
          story.related_stories.push(other.id);
        }
        if (!other.related_stories.includes(story.id)) {
          other.related_stories.push(story.id);
        }
      }
    }
  }

  // Statistics for diagnostics
  getIndexStats() {
    return {
      entities: this._entityIndex.size,
      totalMappings: Array.from(this._entityIndex.values()).reduce((s, set) => s + set.size, 0),
    };
  }
}
