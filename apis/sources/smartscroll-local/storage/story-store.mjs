// apis/sources/smartscroll-local/storage/story-store.mjs
// File-based storage for stories and events.
// One JSON file per story + _index.json summary.
// All methods are synchronous and use in-memory cache for reads.
// For volumes above 50,000 stories consider a database backend.

import { join } from 'path';
import {
  existsSync, mkdirSync, readFileSync, writeFileSync,
  readdirSync, unlinkSync, statSync,
} from 'fs';

export class StoryStore {
  constructor(storageDir) {
    this.dir = storageDir;
    this.indexFile = join(storageDir, '_index.json');
    this.storiesDir = join(storageDir, 'stories');
    this.eventsDir = join(storageDir, 'events');

    this._ensureDirs();
    this._cache = null;
  }

  _ensureDirs() {
    for (const d of [this.dir, this.storiesDir, this.eventsDir]) {
      if (!existsSync(d)) mkdirSync(d, { recursive: true });
    }
  }

  getAllStories() {
    if (this._cache) return this._cache;
    const stories = [];
    if (!existsSync(this.storiesDir)) return stories;

    const files = readdirSync(this.storiesDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      try {
        stories.push(JSON.parse(readFileSync(join(this.storiesDir, f), 'utf8')));
      } catch (err) {
        console.error(`[StoryStore] error reading ${f}:`, err.message);
      }
    }
    this._cache = stories;
    return stories;
  }

  getStory(storyId) {
    const file = join(this.storiesDir, `${storyId}.json`);
    if (!existsSync(file)) return null;
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  }

  getAllEvents() {
    const stories = this.getAllStories();
    const events = [];
    for (const s of stories) {
      events.push(...(s.events || []));
    }
    return events;
  }

  saveStories(stories) {
    const existingIds = new Set(stories.map(s => s.id));
    if (existsSync(this.storiesDir)) {
      for (const f of readdirSync(this.storiesDir)) {
        if (!f.endsWith('.json')) continue;
        const id = f.replace('.json', '');
        if (!existingIds.has(id)) unlinkSync(join(this.storiesDir, f));
      }
    }

    for (const story of stories) {
      const file = join(this.storiesDir, `${story.id}.json`);
      writeFileSync(file, JSON.stringify(story, null, 2), 'utf8');
    }

    const index = stories.map(s => ({
      id: s.id,
      title: s.title,
      status: s.status,
      start_time: s.start_time,
      end_time: s.end_time,
      event_count: s.events?.length || 0,
      entities: (s.entities || []).slice(0, 10),
    }));
    writeFileSync(this.indexFile, JSON.stringify(index, null, 2), 'utf8');

    this._cache = stories;
  }

  saveStory(story) {
    const file = join(this.storiesDir, `${story.id}.json`);
    writeFileSync(file, JSON.stringify(story, null, 2), 'utf8');
    if (this._cache) {
      const idx = this._cache.findIndex(s => s.id === story.id);
      if (idx >= 0) this._cache[idx] = story;
      else this._cache.push(story);
    }
  }

  deleteStory(storyId) {
    const file = join(this.storiesDir, `${storyId}.json`);
    if (existsSync(file)) unlinkSync(file);
    if (this._cache) {
      this._cache = this._cache.filter(s => s.id !== storyId);
    }
  }

  invalidateCache() {
    this._cache = null;
  }

  getSize() {
    let total = 0;
    for (const d of [this.storiesDir, this.eventsDir]) {
      if (!existsSync(d)) continue;
      for (const f of readdirSync(d)) {
        try {
          total += statSync(join(d, f)).size;
        } catch {}
      }
    }
    return total;
  }

  countStories() {
    if (!existsSync(this.storiesDir)) return 0;
    return readdirSync(this.storiesDir).filter(f => f.endsWith('.json')).length;
  }
}
