# OpenSky — Aviation Monitoring

**What it is:** Largest open ADS-B platform for air traffic tracking. Thousands of volunteers transmit data on 10,000+ aircraft: position, altitude, speed, identifiers.

**How to use:**

1. Register at [https://opensky-network.org](https://opensky-network.org)
2. Add to `.env`: `OPENSKY_USERNAME`, `OPENSKY_PASSWORD`
3. Run: `node scripts/collectors/collect-opensky.mjs`
4. Data saves to `/basket/aviation/opensky/`
5. API: `http://localhost:3117/api/opensky?flight=UA123`

**Professional use:** Air traffic backup, fleet tracking, insurance risk, CO2 emissions study.

**❓ FAQ:**

- **Free?** Yes, non-commercial.
- **Data:** ICAO, coordinates, altitude, speed, heading, flight.
- **Retention:** Real-time, 7-day archive.

**🎯 Tutorial:**

```
echo "OPENSKY_USERNAME=login" >> .env
echo "OPENSKY_PASSWORD=password" >> .env
node scripts/collectors/collect-opensky.mjs
curl "http://localhost:3117/api/opensky?flight=SU123"
```