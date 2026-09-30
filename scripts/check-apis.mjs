#!/usr/bin/env node
// ============================================================
// CHECK-APIS.MJS — Проверка всех API-эндпоинтов
// ============================================================

import { promises as fs } from 'fs';
import { join } from 'path';

const API_LIST = [
  '/api/notam/',
  '/api/gps-jamming/',
  '/api/google-trends/',
  '/api/vix/',
  '/api/yield-curve/',
  '/api/gold-oil-ratio/',
  '/api/copper-gold/',
  '/api/bdi/',
  '/api/viirs/',
  '/api/uranium/',
  '/api/big-mac/',
  '/api/debt-gdp/',
  '/api/sp500-vix/',
  '/api/crypto-fear/',
  '/api/oil-gas/',
  '/api/gold-silver/',
  '/api/happiness/',
  '/api/big-mac-alt/',
  '/api/big-mac-main/',
  '/api/vxx/',
  '/api/happiness-alt/',
  '/api/inflation/',
  '/api/unemployment/',
  '/api/pmi/',
  '/api/recession/',
  '/api/dxy/',
  '/api/tips/',
  '/api/ovx/',
  '/api/hy-spread/',
  '/api/war-preparation/',
  '/api/consumer-confidence/',
  '/api/nuclear-monitor/',
  '/api/social-unrest/'
];

const BASKET_DIR = join(process.cwd(), 'data', 'basket');

async function checkAPI(endpoint) {
    try {
        const res = await fetch(`http://localhost:3117${endpoint}`);
        const data = await res.json();
        const count = data.data?.length || 0;
        return { endpoint, status: res.status, count, ok: res.status === 200, sample: data.data?.[0] || null };
    } catch {
        return { endpoint, status: 500, count: 0, ok: false, sample: null };
    }
}

async function checkBasket(name) {
    try {
        const filePath = join(BASKET_DIR, `${name}.json`);
        await fs.access(filePath);
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        return { exists: true, count: data.length || 0 };
    } catch {
        return { exists: false, count: 0 };
    }
}

async function main() {
    console.log('=== ПРОВЕРКА API И КОРЗИНЫ ===\n');
    
    // Получаем ID из API-путей
    const ids = API_LIST.map(p => p.replace(/^\/api\//, '').replace(/\/$/, ''));
    
    // Проверяем корзину
    console.log('📦 КОРЗИНА:');
    for (const id of ids) {
        const basket = await checkBasket(id);
        if (basket.exists) {
            console.log(`  ✅ ${id}: ${basket.count} записей`);
        } else {
            console.log(`  ❌ ${id}: НЕТ ДАННЫХ`);
        }
    }
    
    console.log('\n📡 API (локальный):');
    for (const endpoint of API_LIST) {
        const result = await checkAPI(endpoint);
        const status = result.ok ? '✅' : '❌';
        const sample = result.sample ? Object.keys(result.sample).join(', ') : '—';
        console.log(`  ${status} ${endpoint} → ${result.status} (${result.count} записей) | Ключи: ${sample}`);
    }
}

main().catch(console.error);
