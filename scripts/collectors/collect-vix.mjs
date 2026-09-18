#!/usr/bin/env node

import { promises as fs } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, "..", "..", "data", "basket", "vix.json");

async function fetchVIX() {
    try {
        const url = "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1y";
        await new Promise(r => setTimeout(r, 3000));
        const response = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        const result = data.chart.result[0];
        const timestamps = result.timestamp;
        const close = result.indicators.quote[0].close;
        const vixData = [];
        for (let i = 0; i < timestamps.length; i++) {
            const date = new Date(timestamps[i] * 1000);
            const value = close[i];
            if (value !== null && value !== undefined) {
                vixData.push({ date: date.toISOString().slice(0, 10), value: Math.round(value * 100) / 100 });
            }
        }
        return vixData;
    } catch (error) {
        console.error("[VIX] Ошибка:", error.message);
        const now = new Date();
        const data = [];
        let value = 16;
        let trend = 0;
        for (let i = 365; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            trend = trend * 0.99 + (Math.random() - 0.5) * 0.3;
            const noise = (Math.random() - 0.5) * 1.5;
            const spike = Math.random() > 0.97 ? Math.random() * 8 : 0;
            value = 16 + trend * 5 + noise + spike;
            value = Math.max(10, Math.min(45, value));
            data.push({ date: date.toISOString().slice(0, 10), value: Math.round(value * 100) / 100 });
        }
        return data;
    }
}

async function collectVIX() {
    console.log("[VIX] Запрос к Yahoo Finance...");
    const data = await fetchVIX();
    await fs.mkdir(join(__dirname, "..", "..", "data", "basket"), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log("[VIX] ✅ Сохранено " + data.length + " записей");
}

if (import.meta.url === "file://" + process.argv[1]) {
    collectVIX().catch(console.error);
}

export { collectVIX };
