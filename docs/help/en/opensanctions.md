# OpenSanctions — Global Sanctions Database

**What it is:** Open database aggregating sanctions lists worldwide (OFAC, EU Consolidated, UN, UK, Russian, 100+ sources). Updated daily.

**How to use:**

1. Run: `node scripts/collectors/collect-opensanctions.mjs`
2. Data saves to `/basket/sanctions/opensanctions/`
3. API: `http://localhost:3117/api/opensanctions?q=company&type=entity`

**Professional use:** Corporate compliance, investigative journalism, threat profiling, government reconciliation.

**❓ FAQ:**

- **Difference from OFAC:** Aggregates global lists, not just US.
- **Free?** Yes.
- **Update:** Daily.

**🎯 Tutorial:**

```
node scripts/collectors/collect-opensanctions.mjs
curl "http://localhost:3117/api/opensanctions?q=gazprom&type=entity"
```