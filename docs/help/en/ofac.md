# OFAC — US Sanctions List

**What it is:** US Treasury department managing economic/trade sanctions. Maintains SDN list — individuals, entities, vessels prohibited from doing business.

**How to use:**

1. Run: `node scripts/collectors/collect-ofac.mjs`
2. Data saves to `/basket/sanctions/ofac/`
3. API: `http://localhost:3117/api/ofac?name=Ivanov`

**Professional use:** Bank compliance, legal due diligence, security checks, sanctions monitoring.

**❓ FAQ:**

- **Update:** Daily at 10:00 AM EST.
- **Types:** SDN, Sectoral Sanctions, embargoes, export bans.
- **History:** Archive available on OFAC site.

**🎯 Tutorial:**

```
node scripts/collectors/collect-ofac.mjs
curl "http://localhost:3117/api/ofac?name=Ivanov"
```