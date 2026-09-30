# Predictive — Predictive Analytics

**What it is:** ML module (ARIMA, LSTM, Gradient Boosting, Prophet) forecasting economic indicators, conflicts, disasters, commodity prices.

**How to use:**

1. Ensure 30+ days of historical data
2. Run: `node scripts/collectors/collect-predictive.mjs`
3. Data saves to `/basket/predictive/`
4. API: `http://localhost:3117/api/predictive?target=inflation&horizon=30`

**Professional use:** Trading, budget planning, risk assessment, supply chain disruption forecasting.

**❓ FAQ:**

- **Models:** ARIMA, LSTM, Gradient Boosting, Prophet.
- **Data needed:** Minimum 30 days, 1 year recommended.
- **Accuracy:** 70-95% depending on data.

**🎯 Tutorial:**

```
node scripts/collectors/collect-predictive.mjs
curl "http://localhost:3117/api/predictive?target=inflation&horizon=30"
```