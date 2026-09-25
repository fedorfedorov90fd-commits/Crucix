// apis/sources/smartscroll-local/processing/story-builder.mjs
// Event clustering into stories.
// Similarity metric:
//   entities  (weight 0.5)
// + title sim (weight 0.3)
// + body sim  (weight 0.2)
// Uses inverted index on entities for fast candidate lookup (O(1) per event
// instead of O(N) over all stories).

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

    return stories;
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

    return entitySim * 0.5 + titleSim * 0.3 + bodySim * 0.2;
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
