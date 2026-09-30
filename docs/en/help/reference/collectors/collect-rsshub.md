# collect-rsshub

Back to INDEX

Purpose

RSS feed collector via OPML catalog. Reads data/feeds/feeds.opml, parses feeds, deduplicates by id, truncates to 500 records, saves via saveRaw.

Location

scripts/collectors/collect-rsshub.mjs

Export

Function collectAllFeeds().

Implementation features

Reads data/feeds/feeds.opml (43 feeds).

Parses RSS via regex (item tag, outline tag).

Deduplicates by id (md5 from link or title).

Sorts by pubDate DESC.

Truncates to 500 records (slice 0 to 500).

Saves via saveRaw('rsshub', output, { backwardCompat: true }).

Flag backwardCompat

Value: true.

Consequence: each write overwrites data/basket/rsshub.json entirely.

Symptom: when 0 records are returned (all feeds failed by timeout or rate limit) the basket file is cleared to an empty object (around 129 bytes).

Example of clearing (26.09.2026):

16:55 — 658 KB, 500 items.

17:28 — 129 bytes, 0 items.

21:02 — 129 bytes, 0 items.

Cause of clearing — called from scripts/snapshot-rsshub.mjs (every hour via systemd timer crucix-rsshub-snapshot.timer).

Rule: backwardCompat: true violates rule 14.1 of contract v3. Target collector — collect-rss-unified.mjs with backwardCompat: false.

Dependencies

fs/promises, path, url, crypto.

./lib/collector-helper.mjs — saveRaw.

Data: data/feeds/feeds.opml.

Relations

Used by: scripts/snapshot-rsshub.mjs (every hour via systemd timer).

Writes: data/raw/rsshub-ts.json, data/warehouse/incoming/today.json, data/basket/rsshub.json (with backwardCompat: true).

Read by: apis/sources/rss-feeds-api.mjs, scripts/analyzers/rss-convergence.mjs.

Archive: data/analytics/rss-history/rsshub-ts.json (via snapshot-rsshub.mjs).

Limitations

Regex parser without encoding handling (windows-1251 produces corrupted titles).

Limit of 500 records.

Does not use circuit breaker from feeds-status.json.

No parallel feed processing.

backwardCompat: true violates rule 14.1.

See also

collector-helper.md — saveRaw utility and backwardCompat flag.

INDEX.md — central navigator.
