#!/usr/bin/env node

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = join(process.cwd(), 'data', 'basket');

if (!existsSync(BASKET_DIR)) {
  mkdirSync(BASKET_DIR, { recursive: true });
}

async function fetchCoinGecko() {
  console.log('[CoinGecko] Загрузка данных криптовалют...');

  try {
    const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false';

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    const basketData = {
      source: 'CoinGecko',
      lastUpdated: new Date().toISOString(),
      totalCoins: data.length,
      coins: data.map(c => ({
        id: c.id,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        price: c.current_price,
        marketCap: c.market_cap,
        volume24h: c.total_volume,
        priceChange24h: c.price_change_percentage_24h,
        image: c.image
      }))
    };

    const filePath = join(BASKET_DIR, 'coingecko-latest.json');
    writeFileSync(filePath, JSON.stringify(basketData, null, 2));
    console.log(`[CoinGecko] ✅ Данные сохранены в ${filePath}`);
    console.log(`[CoinGecko] Всего монет: ${basketData.totalCoins}`);

    // Показываем топ-3
    basketData.coins.slice(0, 3).forEach(c => {
      console.log(`  ${c.name} (${c.symbol}): $${c.price} | Изменение: ${c.priceChange24h}%`);
    });

  } catch (error) {
    console.error('[CoinGecko] ❌ Ошибка:', error.message);
    // Сохраняем демо-данные
    const fallbackData = {
      source: 'CoinGecko',
      lastUpdated: new Date().toISOString(),
      totalCoins: 3,
      coins: [
        { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 60000, priceChange24h: 2.5 },
        { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', price: 2600, priceChange24h: 1.8 },
        { id: 'tether', symbol: 'USDT', name: 'Tether', price: 1, priceChange24h: 0.01 },
      ],
      note: 'Демо-данные (API не отвечает)'
    };
    writeFileSync(join(BASKET_DIR, 'coingecko-latest.json'), JSON.stringify(fallbackData, null, 2));
    console.log('[CoinGecko] ✅ Сохранены демо-данные');
  }
}

fetchCoinGecko();
