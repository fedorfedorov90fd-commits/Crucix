# Social — Social Networks & OSINT

**What it is:** Collects data from Twitter/X, Telegram, Reddit, VK, Facebook, Instagram, YouTube. Posts, comments, reactions, hashtags, geolocations, media. Sentiment analysis and trends.

**How to use:**

1. Get API keys for required platforms
2. Add to `.env`
3. Run: `node scripts/collectors/collect-social.mjs`
4. Data saves to `/basket/social/`
5. API: `http://localhost:3117/api/social?platform=twitter&q=war`

**Professional use:** Brand analysis, political sentiment, security threat identification, investigative journalism.

**❓ FAQ:**

- **Platforms:** Twitter/X, Telegram, Reddit, VK, Facebook, Instagram, YouTube.
- **API keys?** Required for most.
- **Metrics:** Text, likes, reposts, comments, geolocation, media.

**🎯 Tutorial:**

```
echo "TWITTER_API_KEY=key" >> .env
echo "TELEGRAM_API_KEY=key" >> .env
node scripts/collectors/collect-social.mjs
curl "http://localhost:3117/api/social?platform=twitter&q=conflict"
```