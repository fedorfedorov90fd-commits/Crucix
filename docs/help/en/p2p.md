# P2P — Decentralized Networks

**What it is:** Tracks activity in BitTorrent, IPFS, Blockchain, DHT. Analyzes: peer count, traffic volume, content popularity, geographic distribution, anomalies.

**How to use:**

1. Run: `node scripts/collectors/collect-p2p.mjs`
2. Data saves to `/basket/network/p2p/`
3. API: `http://localhost:3117/api/p2p?network=bittorrent`

**Professional use:** ISP traffic monitoring, network research, law enforcement, load analysis.

**❓ FAQ:**

- **Networks:** BitTorrent, IPFS, DHT, Blockchain.
- **Safe?** Yes, analyzes open data only.
- **Metrics:** Peers, traffic volume, top content.

**🎯 Tutorial:**

```
node scripts/collectors/collect-p2p.mjs
curl "http://localhost:3117/api/p2p?network=bittorrent"
```