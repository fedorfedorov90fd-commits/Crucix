// apis/sources/smartscroll-interface.mjs
// Общий интерфейс (контракт v3) для SmartScroll.
// Внешний адаптер и локальный движок реализуют его.

/**
 * @typedef {Object} StoryEvent
 * @property {string} id
 * @property {string} source
 * @property {string} published_at
 * @property {string} title
 * @property {string} body
 * @property {string[]} entities
 * @property {string} story_id
 * @property {string[]} related_stories
 * @property {Object} [raw]
 */

/**
 * @typedef {Object} Story
 * @property {string} id
 * @property {string} title
 * @property {string} summary
 * @property {string} status
 * @property {string} start_time
 * @property {string} end_time
 * @property {string[]} entities
 * @property {StoryEvent[]} events
 * @property {string[]} related_stories
 */

/**
 * @typedef {Object} TimelineEntry
 * @property {string} time
 * @property {string} title
 * @property {string} body
 * @property {string} source
 */

export class SmartScrollInterface {
  async fetchStories(opts = {}) {
    throw new Error('fetchStories() not implemented');
  }

  async fetchStoryDetail(storyId) {
    throw new Error('fetchStoryDetail() not implemented');
  }

  async fetchTimeline(storyId) {
    throw new Error('fetchTimeline() not implemented');
  }

  async healthCheck() {
    throw new Error('healthCheck() not implemented');
  }
}
