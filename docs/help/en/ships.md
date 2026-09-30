# Ships — Maritime AIS Tracking

**What it is:** AIS data for all vessels worldwide: position, speed, heading, MMSI, type, destination, draft. Updates every 2-10 seconds.

**How to use:**

1. Run: `node scripts/collectors/collect-ships.mjs`
2. Data saves to `/basket/maritime/ships/`
3. API: `http://localhost:3117/api/ships?mmsi=123456789`

**Professional use:** Port authorities, Coast Guard, logistics optimization, military naval monitoring.

**❓ FAQ:**

- **Free?** Yes, non-commercial.
- **Data:** MMSI, coordinates, speed, heading, type, port, draft.
- **Retention:** Real-time, 7-day archive.

**🎯 Tutorial:**

```
node scripts/collectors/collect-ships.mjs
curl "http://localhost:3117/api/ships?mmsi=123456789"
```