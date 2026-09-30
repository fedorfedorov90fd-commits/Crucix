# USGS — US Geological Survey

**What it is:** US agency monitoring earthquakes, volcanic eruptions, landslides, tsunamis. Real-time seismic data worldwide.

**How to use:**

1. Run: `node scripts/collectors/collect-usgs.mjs`
2. Data saves to `/basket/geology/usgs/`
3. API: `http://localhost:3117/api/usgs?mag=4.5&days=7`

**Professional use:** Seismologists analyze patterns, insurance risk, construction design, rescue planning.

**❓ FAQ:**

- **Free?** Yes.
- **Data:** Magnitude, coordinates, depth, time, tsunami.
- **Update:** Real-time, every 5 minutes.

**🎯 Tutorial:**

```
node scripts/collectors/collect-usgs.mjs
curl "http://localhost:3117/api/usgs?mag=4.5&days=7"
```