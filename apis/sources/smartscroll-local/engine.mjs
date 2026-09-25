// apis/sources/smartscroll-local/engine.mjs
// Local SmartScroll engine core.
// Cycle: collect -> normalize -> dedup -> cluster -> summarize -> store.
// Collects per-stage timing metrics for diagnostics.
// Public entry point for full cycle: runCycle().

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SmartScrollInterface } from '../smartscroll-interface.mjs';
import { RSSCollector } from '../../../scripts/collectors/lib/rss-collector.mjs';
import { TelegramCollector } from '../../../scripts/collectors/lib/telegram-collector.mjs';
import { Normalizer } from './processing/normalizer.mjs';
import { Deduplicator } from './processing/dedup.mjs';
import { StoryBuilder } from './processing/story-builder.mjs';
import { Summarizer } from './processing/summarizer.mjs';
import { TimelineBuilder } from './processing/timeline.mjs';
import { StoryStore } from './storage/story-store.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class SmartScrollLocalEngine extends SmartScrollInterface {
  constructor(config) {
    super();
    this.config = config;
    this.localConfig = config.local || {};
    this.mode = 'local';

    this.collectInterval = this.localConfig.collect_interval_ms || 300000;
    this.maxStoryAge = (this.localConfig.max_story_age_hours || 168) * 3600 * 1000;
    this.maxEventsPerStory = this.localConfig.max_events_per_story || 200;
    this.dedupThreshold = this.localConfig.dedup_threshold || 0.75;
    this.storyThreshold = this.localConfig.story_similarity_threshold || 0.35;
    this.summarySentences = this.localConfig.summary_sentences || 3;
    this.storageDir = this.localConfig.storage_dir ||
      join(__dirname, '../../../data/smartscroll');

    this.store = new StoryStore(this.storageDir);
    this.normalizer = new Normalizer();
    this.dedup = new Deduplicator(this.dedupThreshold);
    this.storyBuilder = new StoryBuilder(this.storyThreshold);
    this.summarizer = new Summarizer(this.summarySentences);
    this.timeline = new TimelineBuilder();

    this.collectors = [];
    this._initCollectors();

    this.isRunning = false;
    this.timer = null;
    this.cleanupTimer = null;
    this._lastCollect = 0;

    this.metrics = {
      cycles_total: 0,
      cycles_failed: 0,
      last_cycle: null,
      stage_times_ms: {
        collect: [],
        normalize: [],
        dedup: [],
        cluster: [],
        summarize: [],
        store: [],
      },
      totals: {
        raw_events: 0,
        unique_events: 0,
        stories_created: 0,
        summaries_generated: 0,
      },
    };
  }

  _initCollectors() {
    const sources = this.config.sources || {};
    for (const feed of (sources.rss || [])) {
      if (feed.enabled !== false) this.collectors.push(new RSSCollector(feed));
    }
    for (const ch of (sources.telegram || [])) {
      if (ch.enabled !== false) this.collectors.push(new TelegramCollector(ch));
    }
  }

  _time(fn) {
    const t0 = Date.now();
    const result = fn();
    return { result, ms: Date.now() - t0 };
  }

  async _timeAsync(fn) {
    const t0 = Date.now();
    const result = await fn();
    return { result, ms: Date.now() - t0 };
  }

  _recordStage(stage, ms) {
    const arr = this.metrics.stage_times_ms[stage];
    if (!arr) return;
    arr.push(ms);
    if (arr.length > 100) arr.shift();
  }

  /**
   * Public entry point for a full collect cycle.
   * Called by HTTP server /collect endpoint or by cron.
   * @returns {Promise<Object>} cycle result
   */
  async runCycle() {
    return await this._collectCycle();
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    await this._collectCycle();
    this.timer = setInterval(() => {
      this._collectCycle().catch(err =>
        console.error('[SmartScroll local] collect error:', err.message)
      );
    }, this.collectInterval);
    const cleanupInterval = this.localConfig.cleanup_interval_ms || 3600000;
    this.cleanupTimer = setInterval(() => {
      this._cleanup().catch(err =>
        console.error('[SmartScroll local] cleanup error:', err.message)
      );
    }, cleanupInterval);
    console.log(`[SmartScroll local] engine started, ${this.collectors.length} collectors, interval=${this.collectInterval}ms`);
  }

  async stop() {
    this.isRunning = false;
    if (this.timer) clearInterval(this.timer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    console.log('[SmartScroll local] engine stopped');
  }

  async _collectCycle() {
    const cycleStart = Date.now();
    const cycleMetrics = {};

    const collectPhase = await this._timeAsync(async () => {
      const raw = [];
      for (const collector of this.collectors) {
        try {
          const events = await collector.collect();
          raw.push(...events);
        } catch (err) {
          console.error(`[SmartScroll local] collector ${collector.name} error:`, err.message);
        }
      }
      return raw;
    });
    this._recordStage('collect', collectPhase.ms);
    cycleMetrics.collect_ms = collectPhase.ms;
    const rawEvents = collectPhase.result;

    if (rawEvents.length === 0) {
      this._finishCycle(cycleStart, cycleMetrics, 0, 0, 0);
      return this._lastCycleResult(cycleStart, 0, 0, 0);
    }
    cycleMetrics.raw_count = rawEvents.length;

    const normPhase = this._time(() => rawEvents.map(e => this.normalizer.normalize(e)));
    this._recordStage('normalize', normPhase.ms);
    cycleMetrics.normalize_ms = normPhase.ms;
    const normalized = normPhase.result;

    const existing = this.store.getAllEvents();
    const dedupPhase = this._time(() => this.dedup.deduplicate(normalized, existing));
    this._recordStage('dedup', dedupPhase.ms);
    cycleMetrics.dedup_ms = dedupPhase.ms;
    const unique = dedupPhase.result;
    cycleMetrics.unique_count = unique.length;

    if (unique.length === 0) {
      this._finishCycle(cycleStart, cycleMetrics, rawEvents.length, 0, 0);
      return this._lastCycleResult(cycleStart, rawEvents.length, 0, 0);
    }

    let stories = this.store.getAllStories();
    const clusterPhase = this._time(() => this.storyBuilder.addToStories(unique, stories));
    this._recordStage('cluster', clusterPhase.ms);
    cycleMetrics.cluster_ms = clusterPhase.ms;
    stories = clusterPhase.result;

    for (const s of stories) {
      if (s.events.length > this.maxEventsPerStory) {
        s.events = s.events.slice(-this.maxEventsPerStory);
      }
    }

    let summariesCount = 0;
    const sumPhase = this._time(() => {
      for (const s of stories) {
        if (s._dirty) {
          s.summary = this.summarizer.summarize(s.events);
          s.end_time = s.events[s.events.length - 1]?.published_at || s.end_time;
          s.status = s.status === 'closed' ? 'closed' : 'active';
          delete s._dirty;
          summariesCount++;
        }
      }
      return summariesCount;
    });
    this._recordStage('summarize', sumPhase.ms);
    cycleMetrics.summarize_ms = sumPhase.ms;
    cycleMetrics.summaries_count = sumPhase.result;

    const storePhase = this._time(() => this.store.saveStories(stories));
    this._recordStage('store', storePhase.ms);
    cycleMetrics.store_ms = storePhase.ms;
    cycleMetrics.stories_count = stories.length;

    this._finishCycle(cycleStart, cycleMetrics, rawEvents.length, unique.length, stories.length);
    this.metrics.totals.summaries_generated += sumPhase.result;

    console.log(`[SmartScroll local] cycle: collected ${rawEvents.length}, unique ${unique.length}, stories ${stories.length}, took ${Date.now() - cycleStart}ms`);
    return this._lastCycleResult(cycleStart, rawEvents.length, unique.length, stories.length);
  }

  _lastCycleResult(startTime, rawCount, uniqueCount, storyCount) {
    return {
      collected: rawCount,
      unique: uniqueCount,
      stories: storyCount,
      duration_ms: Date.now() - startTime,
    };
  }

  _finishCycle(startTime, cycleMetrics, rawCount, uniqueCount, storyCount) {
    this._lastCollect = Date.now();
    this.metrics.cycles_total++;
    this.metrics.totals.raw_events += rawCount;
    this.metrics.totals.unique_events += uniqueCount;
    this.metrics.totals.stories_created = storyCount;
    cycleMetrics.total_ms = Date.now() - startTime;
    this.metrics.last_cycle = {
      timestamp: new Date().toISOString(),
      ...cycleMetrics,
    };
  }

  async _cleanup() {
    const stories = this.store.getAllStories();
    const now = Date.now();
    const kept = stories.filter(s => {
      const end = new Date(s.end_time || s.start_time).getTime();
      return now - end < this.maxStoryAge;
    });
    if (kept.length < stories.length) {
      this.store.saveStories(kept);
      console.log(`[SmartScroll local] cleanup: removed ${stories.length - kept.length} old stories`);
    }
  }

  async fetchStories(opts = {}) {
    let stories = this.store.getAllStories();
    if (opts.since) {
      const since = new Date(opts.since).getTime();
      stories = stories.filter(s => new Date(s.start_time).getTime() >= since);
    }
    if (opts.topics?.length) {
      stories = stories.filter(s =>
        s.entities.some(e => opts.topics.includes(e))
      );
    }
    if (opts.limit) stories = stories.slice(0, opts.limit);
    return stories;
  }

  async fetchStoryDetail(storyId) {
    return this.store.getStory(storyId);
  }

  async fetchTimeline(storyId) {
    const story = this.store.getStory(storyId);
    if (!story) return [];
    return this.timeline.build(story.events);
  }

  async healthCheck() {
    return {
      ok: true,
      mode: this.mode,
      details: {
        collectors: this.collectors.length,
        stories: this.store.getAllStories().length,
        isRunning: this.isRunning,
        lastCollect: new Date(this._lastCollect).toISOString(),
      },
    };
  }

  getMetrics() {
    const summary = {};
    for (const [stage, times] of Object.entries(this.metrics.stage_times_ms)) {
      if (times.length === 0) {
        summary[stage] = { count: 0 };
        continue;
      }
      const sum = times.reduce((a, b) => a + b, 0);
      summary[stage] = {
        count: times.length,
        avg_ms: Math.round((sum / times.length) * 100) / 100,
        min_ms: Math.min(...times),
        max_ms: Math.max(...times),
        last_ms: times[times.length - 1],
      };
    }
    return {
      cycles_total: this.metrics.cycles_total,
      cycles_failed: this.metrics.cycles_failed,
      totals: this.metrics.totals,
      stages: summary,
      last_cycle: this.metrics.last_cycle,
    };
  }
}
