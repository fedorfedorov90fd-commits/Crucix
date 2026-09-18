# MASA — Maritime Anomaly Analysis

**What it is:** Analytical module detecting unusual vessel behavior (AIS turned off, sudden maneuvers, prohibited zones, irregular routes, open-sea meetings).

**How to use:**

1. Ensure ships module is running
2. Run: `node scripts/collectors/collect-masa.mjs`
3. Data saves to `/basket/maritime/masa/`
4. API: `http://localhost:3117/api/masa?anomaly=speed&threshold=30`

**Professional use:** Coast Guard, naval forces, insurance risk, environmental monitoring.

**❓ FAQ:**

- **Anomalies:** AIS off, maneuvers, prohibited zones, irregular routes, meetings, anomalous speed.
- **Data needed:** Only AIS from ships module.
- **Analysis frequency:** Hourly or on schedule.

**🎯 Tutorial:**

```
node scripts/collectors/collect-ships.mjs
node scripts/collectors/collect-masa.mjs
curl "http://localhost:3117/api/masa?anomaly=speed&threshold=30"
```