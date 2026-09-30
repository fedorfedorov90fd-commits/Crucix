# TASS — TASS News

**What it is:** Russian state news agency (ITAR-TASS), one of world's largest. Provides news in Russian and English: politics, economy, science, culture, sports.

**How to use:**

1. Run: `node scripts/collectors/collect-tass.mjs`
2. Data saves to `/basket/news/tass/`
3. API: `http://localhost:3117/api/tass?category=politics`

**Professional use:** Official statements analysis, agenda tracking, journalism, narrative research.

**❓ FAQ:**

- **Free?** Yes, RSS feeds freely available.
- **Categories:** Politics, economy, science, culture, sports.
- **Languages:** Russian and English.

**🎯 Tutorial:**

```
node scripts/collectors/collect-tass.mjs
curl "http://localhost:3117/api/tass?category=politics"
```