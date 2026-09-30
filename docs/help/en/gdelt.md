# GDELT — Global Event Database

**What it is:** World's largest event database (100+ languages, 300+ categories, 500M+ records since 1979). Updates every 15 minutes.

**How to use:**

1. Run: `node scripts/collectors/collect-gdelt.mjs`
2. Data saves to `/basket/osint/gdelt/`
3. API: `http://localhost:3117/api/gdelt?country=RU&days=7`

**Professional use:** Track conflicts, predict instability, investigative journalism, peace research, intelligence.

**❓ FAQ:**

- **Free?** Yes, academic project funded by Google.
- **Accuracy?** 85-95% depending on region.
- **Error 403/503?** Retry with exponential backoff.

**🎯 Tutorial:**

```
node scripts/collectors/collect-gdelt.mjs --limit=10
curl "http://localhost:3117/api/gdelt?country=UA&days=1"
```