# NOAA — US Weather & Climate

**What it is:** US leading agency for meteorology, climatology, oceanography, geophysics. Real-time: forecasts, satellite imagery, buoy data, hurricane/tsunami warnings, air quality, radiation.

**How to use:**

1. Get token at [https://www.ncdc.noaa.gov/cdo-web/token](https://www.ncdc.noaa.gov/cdo-web/token)
2. Add to `.env`: `NOAA_TOKEN=your_token`
3. Run: `node scripts/collectors/collect-noaa.mjs`
4. Data saves to `/basket/weather/noaa/`
5. API: `http://localhost:3117/api/noaa?lat=55.75&lon=37.62`

**Professional use:** Weather models, route planning, crop optimization, climate research.

**❓ FAQ:**

- **Free?** Yes.
- **Data:** Forecasts, satellite, buoys, warnings, air quality.
- **Update:** 5 min to 6 hours depending on type.

**🎯 Tutorial:**

```
echo "NOAA_TOKEN=your_token" >> .env
node scripts/collectors/collect-noaa.mjs
curl "http://localhost:3117/api/noaa?lat=55.75&lon=37.62"
```