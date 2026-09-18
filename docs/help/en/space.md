# Space — Space Monitoring

**What it is:** Monitors satellites, rocket launches, space debris, solar activity, geomagnetic storms. Uses NASA, ESA, Space-Track data.

**How to use:**

1. Run: `node scripts/collectors/collect-space.mjs`
2. Data saves to `/basket/space/`
3. API: `http://localhost:3117/api/space?satellite=ISS`

**Professional use:** Orbit correction, launch planning, telecom outage prediction, collision risk assessment.

**❓ FAQ:**

- **Satellites:** 10,000+ from Space-Track catalog.
- **Update:** Hourly for TLE, real-time for positions.
- **Solar data:** Flares, CMEs, radiation storms.

**🎯 Tutorial:**

```
node scripts/collectors/collect-space.mjs
curl "http://localhost:3117/api/space?satellite=ISS"
```