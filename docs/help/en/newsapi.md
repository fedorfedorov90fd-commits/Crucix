# NewsAPI — News Aggregator

**What it is:** Service providing access to news articles from thousands of sources (CNN, BBC, Reuters, Al Jazeera, TASS, Xinhua). Filter by keywords, countries, languages, categories, dates.

**How to use:**

1. Register at [https://newsapi.org](https://newsapi.org)
2. Add to `.env`: `NEWSAPI_KEY=your_key`
3. Run: `node scripts/collectors/collect-newsapi.mjs`
4. Data saves to `/basket/news/`
5. API: `http://localhost:3117/api/news?q=conflict&lang=en`

**Professional use:** Sentiment analysis, brand monitoring, media landscape research, crisis early warning.

**❓ FAQ:**

- **Free?** 100 requests/day free; paid up to 50,000/day.
- **Languages:** 100+ including Russian, English, Chinese, Arabic.
- **Time period:** Last 30 days (free), up to 1 year (paid).

**🎯 Tutorial:**

```
echo "NEWSAPI_KEY=your_key" >> .env
node scripts/collectors/collect-newsapi.mjs
curl "http://localhost:3117/api/news?q=conflict&lang=en"
```