
Модуль Blockchain (Блокчейн)
Описание
Модуль Blockchain отслеживает данные блокчейн-сетей: цены криптовалют, объёмы транзакций, активность адресов, газ (комиссии) и индексы децентрализованных финансов (DeFi).

API Endpoints
Метод	Путь	Описание
GET	/api/blockchain/prices	Текущие цены криптовалют
GET	/api/blockchain/price/:symbol	Цена конкретной монеты
GET	/api/blockchain/transactions	Статистика транзакций
GET	/api/blockchain/gas	Текущие цены на газ (Ethereum)
GET	/api/blockchain/defi	Децентрализованные финансы — TVL, индексы
GET	/api/blockchain/fear-greed	Индекс страха и жадности
Пример запроса
bash
curl -X GET http://localhost:3117/api/blockchain/prices?symbols=BTC,ETH,SOL
Формат ответа
json
{
  "prices": {
    "BTC": { "usd": 61234.56, "change24h": 2.3, "volume24h": 28400000000 },
    "ETH": { "usd": 3456.78, "change24h": 1.2, "volume24h": 12000000000 }
  },
  "timestamp": "2026-09-01T22:30:00Z"
}
Источники данных
Binance API (цены и объёмы)

Etherscan (транзакции и газ)

DeFi Llama (TVL DeFi-протоколов)

CoinGecko (альтернативные цены)

Конфигурация
Настраивается в /config/blockchain.json. Поддерживаемые параметры:

symbols — список отслеживаемых монет

updateInterval — частота обновления (сек)

sources — предпочитаемые источники данных
