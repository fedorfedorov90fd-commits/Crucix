# Voice — Voice Interface

**What it is:** Speech recognition & synthesis module. Control Crucix by voice: ask questions, request reports, receive alerts. Supports 50+ languages including Russian.

**How to use:**

1. Set up microphone and speakers
2. Get STT/TTS API key (Google, Microsoft, OpenAI)
3. Add to `.env`
4. Run: `node scripts/collectors/collect-voice.mjs`
5. Say: "Crucix, show sanctions report"

**Professional use:** Operations centers, hands-free dispatch, accessibility, alert integration.

**❓ FAQ:**

- **Languages:** 50+ including Russian, English, Chinese.
- **Internet?** Yes for cloud APIs, no for local models.
- **Commands:** Any, configurable.

**🎯 Tutorial:**

```
echo "STT_API_KEY=key" >> .env
echo "TTS_API_KEY=key" >> .env
node scripts/collectors/collect-voice.mjs
# Say: "Crucix, show sanctions report"
```