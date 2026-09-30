# FRED — US Federal Reserve

**What it is:** Largest US macroeconomic database (800,000+ time series: GDP, CPI, unemployment, rates, M1/M2, industrial production).

**How to use:**

1. Get free API key at [https://fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html)
2. Add to `.env`: `FRED_API_KEY=your_key`
3. Run: `node scripts/collectors/collect-fred.mjs`
4. Data saves to `/basket/economic/fred/`
5. API: `http://localhost:3117/api/fred?series=GDP`

**Professional use:** Economists build models, traders monitor Fed rates, analysts create dashboards, researchers publish papers.

**❓ FAQ:**

- **Free?** Yes, for non-commercial use.
- **Data updates?** Daily (rates), weekly (unemployment claims), monthly (CPI), quarterly (GDP).
- **Error 401?** Check API key in `.env`; regenerate on FRED site.

**🎯 Tutorial:**

```
# Get key → save to .env → run collector
node scripts/collectors/collect-fred.mjs
curl http://localhost:3117/api/fred?series=GDP
```