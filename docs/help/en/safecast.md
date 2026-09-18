# Safecast — Radiation Monitoring

**What it is:** Global citizen science project collecting radiation data. Uses portable Geiger counters. Real-time background, especially relevant after nuclear accidents.

**How to use:**

1. Run: `node scripts/collectors/collect-safecast.mjs`
2. Data saves to `/basket/environment/safecast/`
3. API: `http://localhost:3117/api/safecast?lat=37.5&lon=141.0&radius=50`

**Professional use:** Epidemiologists monitor nuclear aftermath, governments check background, rescuers plan evacuation.

**❓ FAQ:**

- **Accuracy:** +/- 10-15%.
- **Units:** µSv/h and µR/h.
- **Update:** Real-time.

**🎯 Tutorial:**

```
node scripts/collectors/collect-safecast.mjs
curl "http://localhost:3117/api/safecast?lat=37.5&lon=141.0&radius=50"
```