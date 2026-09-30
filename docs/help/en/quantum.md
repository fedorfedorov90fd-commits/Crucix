# Quantum — Quantum Computing

**What it is:** Tracks quantum computing and post-quantum cryptography news: new processors, arXiv papers, RSA/ECC threats, migration to Kyber/Dilithium.

**How to use:**

1. Run: `node scripts/collectors/collect-quantum.mjs`
2. Data saves to `/basket/quantum/`
3. API: `http://localhost:3117/api/quantum?type=breakthrough`

**Professional use:** Cryptographers track quantum attacks, security experts plan migration, investors evaluate quantum companies.

**❓ FAQ:**

- **Sources:** arXiv, NewsAPI, Google Scholar, company blogs.
- **Update:** Hourly.
- **Algorithms:** RSA, ECC, Kyber, Dilithium, SPHINCS+.

**🎯 Tutorial:**

```
node scripts/collectors/collect-quantum.mjs
curl "http://localhost:3117/api/quantum?type=breakthrough"
```