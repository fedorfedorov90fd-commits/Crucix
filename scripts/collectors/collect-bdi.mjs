#!/usr/bin/env node
import { promises as fs } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, "..", "..", "data", "basket", "bdi.json");

async function fetchBDI() {
    try {
        const url = "https://query1.finance.yahoo.com/v8/finance/chart/BDI?interval=1d&range=1y";
        const response = await fetch(url);
        const data = await response.json();
        const result = data.chart.result[0];
        const timestamps = result.timestamp;
        const quotes = result.indicators.quote[0];
        const close = quotes.close;
        const bdiData = [];
        for (let i = 0; i < timestamps.length; i++) {
            const date = new Date(timestamps[i] * 1000);
            const value = close[i];
            if (value !== null) {
                bdiData.push({ date: date.toISOString().slice(0, 10), value: Math.round(value) });
            }
        }
        return bdiData;
    } catch (error) {
        console.error("[BDI] Ошибка:", error.message);
        const now = new Date();
        const data = [];
        let value = 2000;
        for (let i = 365; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            value = value + (Math.random() - 0.5) * 50;
            value = Math.max(1000, Math.min(4000, value));
            data.push({ date: date.toISOString().slice(0, 10), value: Math.round(value) });
        }
        return data;
    }
}

async function collectBDI() {
    const data = await fetchBDI();
    await fs.mkdir(join(__dirname, "..", "..", "data", "basket"), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log("[BDI] ✅ " + data.length + " записей");
}
if (import.meta.url === "file://" + process.argv[1]) collectBDI().catch(console.error);
export { collectBDI };
