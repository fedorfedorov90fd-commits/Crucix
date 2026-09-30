# Blockchain Module

## 📋 Описание
**Русский:**
Модуль **Blockchain** отслеживает данные блокчейн-сетей: цены криптовалют, объёмы транзакций, активность адресов, газ (комиссии) и индексы DeFi. Интегрируется с Binance, Etherscan, DeFi Llama и CoinGecko.

**English:**
The **Blockchain** module tracks blockchain network data: cryptocurrency prices, transaction volumes, address activity, gas fees and DeFi indices. Integrates with Binance, Etherscan, DeFi Llama and CoinGecko.

## 🎯 Назначение
- Мониторинг криптовалют
- Анализ транзакций
- Отслеживание DeFi-протоколов
- Индекс страха и жадности

## 🚀 Использование
1. Страница: `/blockchain`
2. API: `/api/blockchain`
3. Параметры: `?symbols=BTC,ETH,SOL`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/blockchain.html` |
| API | `apis/sources/blockchain.mjs` |

**Статус:** 🟢 Активен
**Источники:** Binance, Etherscan, DeFi Llama, CoinGecko
