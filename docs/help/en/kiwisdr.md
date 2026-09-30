# KiwiSDR — Radio Frequency Monitoring

**What it is:** Global network of SDR receivers (0-30 MHz, HF band). Tracks aviation, maritime, ham radio, emergency alerts, long-distance stations. 100+ stations worldwide.

**How to use:**

1. Run: `node scripts/collectors/collect-kiwisdr.mjs`
2. Data saves to `/basket/signals/kiwisdr/`
3. API: `http://localhost:3117/api/kiwisdr?freq=5000`

**Professional use:** Emergency signal tracking, ionosphere research, military HF analysis, amateur radio.

**❓ FAQ:**

- **Equipment?** No, uses public stations.
- **Real-time?** Yes, via WebSockets.
- **Frequencies:** 0-30 MHz.

**🎯 Tutorial:**

```
node scripts/collectors/collect-kiwisdr.mjs
curl "http://localhost:3117/api/kiwisdr?freq=5000"
```