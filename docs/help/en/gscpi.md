# GSCPI — Supply Chain Pressure Index

**What it is:** NY Fed index measuring global supply chain stress (shipping costs, delivery times, PMI, border delays, inventory). Normalized (mean=0), >0 = pressure, <0 = easing.

**How to use:**

1. Run: `node scripts/collectors/collect-gscpi.mjs`
2. Data saves to `/basket/economic/gscpi/`
3. API: `http://localhost:3117/api/gscpi`

**Professional use:** Logistics planning, inflation prediction, central bank decisions, inventory optimization.

**❓ FAQ:**

- **Interpretation:** 0=normal, >0=pressure (delays, cost rises), <0=easing.
- **Update:** Monthly, mid-month.
- **History:** Since January 1997.

**🎯 Tutorial:**

```
node scripts/collectors/collect-gscpi.mjs
curl http://localhost:3117/api/gscpi
```