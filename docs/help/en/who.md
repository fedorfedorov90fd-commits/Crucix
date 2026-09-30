# WHO — World Health Organization

**What it is:** UN agency for health. Data on infectious disease outbreaks, vaccination, mortality, healthcare systems, nutrition, sanitation.

**How to use:**

1. Run: `node scripts/collectors/collect-who.mjs`
2. Data saves to `/basket/health/who/`
3. API: `http://localhost:3117/api/who?disease=COVID-19&country=RU`

**Professional use:** Health ministries coordinate responses, pharma production planning, insurance risk, new infection tracking.

**❓ FAQ:**

- **Free?** Yes, WHO data is open.
- **Data:** Cases, deaths, vaccination, healthcare systems.
- **Update:** Daily for COVID-19, monthly for others.

**🎯 Tutorial:**

```
node scripts/collectors/collect-who.mjs
curl "http://localhost:3117/api/who?disease=COVID-19&country=RU"
```