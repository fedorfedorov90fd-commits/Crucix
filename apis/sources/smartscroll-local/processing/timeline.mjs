// apis/sources/smartscroll-local/processing/timeline.mjs
// Построение хронологии событий сюжета.

export class TimelineBuilder {
  build(events) {
    if (!events || events.length === 0) return [];

    const sorted = [...events].sort((a, b) =>
      new Date(a.published_at) - new Date(b.published_at)
    );

    const seen = new Set();
    const timeline = [];

    for (const ev of sorted) {
      const key = `${ev.published_at}:${ev.title}`;
      if (seen.has(key)) continue;
      seen.add(key);

      timeline.push({
        time: ev.published_at,
        title: ev.title,
        body: ev.body.slice(0, 500),
        source: ev.source,
      });
    }

    return timeline;
  }

  groupByDay(events) {
    const groups = {};
    for (const ev of events) {
      const day = ev.published_at.split('T')[0];
      if (!groups[day]) groups[day] = [];
      groups[day].push({
        time: ev.published_at,
        title: ev.title,
        source: ev.source,
      });
    }
    return groups;
  }
}
