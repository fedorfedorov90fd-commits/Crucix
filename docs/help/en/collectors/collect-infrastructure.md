# collect-infrastructure

## Source
Local file data/infrastructure/objects.json (114 critical infrastructure objects).

## Frequency
On demand. Run manually or as part of general collector cycle.

## Data format
Array of objects:
{
  "id": "string",
  "name": "string",
  "type": "string",
  "country": "string",
  "lat": number,
  "lon": number,
  "severity": number,
  "timestamp": "ISO8601"
}

## Example
[
  {
    "id": "mil-base-001",
    "name": "Pentagon",
    "type": "headquarters",
    "country": "USA",
    "lat": 38.8719,
    "lon": -77.0563,
    "severity": 0.5,
    "timestamp": "2026-09-18T00:00:00.000Z"
  }
]

## Run
node scripts/collectors/collect-infrastructure.mjs

## Output
data/basket/infrastructure.json

## Log
logs/collectors/collect-infrastructure.log
