
Blockchain Module
Description
The Blockchain module tracks blockchain network data: cryptocurrency prices, transaction volumes, address activity, gas fees, and decentralized finance (DeFi) indices.

API Endpoints
Method	Path	Description
GET	/api/blockchain/prices	Current cryptocurrency prices
GET	/api/blockchain/price/:symbol	Price of a specific coin
GET	/api/blockchain/transactions	Transaction statistics
GET	/api/blockchain/gas	Current gas prices (Ethereum)
GET	/api/blockchain/defi	DeFi — TVL, indices
GET	/api/blockchain/fear-greed	Fear & Greed Index
Example Request
bash
curl -X GET http://localhost:3117/api/blockchain/prices?symbols=BTC,ETH,SOL
Response Format
json
{
  "prices": {
    "BTC": { "usd": 61234.56, "change24h": 2.3, "volume24h": 28400000000 },
    "ETH": { "usd": 3456.78, "change24h": 1.2, "volume24h": 12000000000 }
  },
  "timestamp": "2026-09-01T22:30:00Z"
}
Data Sources
Binance API (prices and volumes)

Etherscan (transactions and gas)

DeFi Llama (DeFi protocol TVL)

CoinGecko (alternative prices)

Configuration
Configured in /config/blockchain.json. Supported parameters:

symbols — list of tracked coins

updateInterval — update frequency (seconds)

sources — preferred data sources

Version: 1.0
Updated: 2026-09-02
