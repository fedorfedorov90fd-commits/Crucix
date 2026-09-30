# collector-helper

Back to INDEX

Purpose

Utility saveRaw — the single point of writing raw collector data in Crucix. Saves data to data/raw/, registers a manifest in data/warehouse/incoming/, and, with the legacy flag backwardCompat, duplicates the write to basket directly.

Location

scripts/collectors/lib/collector-helper.mjs

Export

Function saveRaw(id, data, options).

Methods, Parameters, Response

saveRaw(id, data, options)

Parameters:

id (string, required) — item identifier. Latin, digits, hyphen.

data (any, required) — raw data, serialized to JSON.

options (object, optional):

collector — collector name. Default collect-id.mjs.

source — source name.

source_url — exact request URL.

license — license (public-domain, cc-by, cc-zero).

format_hint — format hint (timeseries, points, regions, events, hierarchical, catalog).

value_unit, value_type, value_scale — value parameters.

period, granularity — period and granularity.

record_count — expected number of records.

backwardCompat (boolean, default true) — whether to write to basket/id.json.

notes — free field.

Returns: object with fields raw_file, incoming_file, basket_file, checksum, bytes, id.

Flag backwardCompat

Flag backwardCompat controls writing to basket directly.

backwardCompat: false (correct value):

Collector writes only to data/raw/.

Registers manifest in data/warehouse/incoming/.

Basket is updated via storekeeper (scripts/warehouse/managerbasket.mjs) during normalization.

Corresponds to rule 14.1 of contract v3: Collector does not write to basket.

backwardCompat: true (legacy value):

Collector writes to data/raw/, manifest, and directly to data/basket/id.json.

Overwrites basket file entirely on each run.

Violates rule 14.1.

Symptom: if collector returned 0 records — basket file is cleared.

Architectural debt left for compatibility with collectors from before contract v3.

Rule: new collectors must use backwardCompat: false. Existing — migration in plan.

Dependencies

fs/promises — file operations.

crypto — sha256 hash.

Internal: atomicWrite, nowIso, timestampSuffix, upsertItem.

Relations

Used by: all collectors in scripts/collectors/collect-*.mjs (118 files).

Uses: file system (data/raw/, data/warehouse/incoming/, data/basket/).

Updated in parallel: managerbasket.mjs (reads manifests, writes basket).

Limitations

Does not validate data against crucix.basket.v1 schema — validation in validate.mjs.

Does not check record_count against actual number of records.

Does not manage tiered raw policy (fresh, working, archive) — that is in storekeeper.

Example

import saveRaw from ./lib/collector-helper.mjs.

const items = await fetchFromApi();

await saveRaw('my-collector', items, { collector: 'collect-my-collector.mjs', source: 'My API', source_url: 'https://api.example.com/v1/items', license: 'public-domain', format_hint: 'events', value_type: 'count', granularity: 'event', record_count: items.length, backwardCompat: false });

See also

collect-rsshub.md — collector using backwardCompat: true.

INDEX.md — central navigator.
