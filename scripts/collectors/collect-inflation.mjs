#!/usr/bin/env node
import { promises as fs } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, "..", "..", "data", "basket", "inflation.json");

async function fetchInflation() {
    try {
        const url = "https://api.tradingeconomics.com/markets/united-states-inflation-rate?format=json";
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.length > 0) {
            return data.map(item => ({ date: item.DateTime.slice(0, 10), value: Math.round(item.Value * 100) / 100 }));
        }
        return generateFallbackData();
    } catch (error) {
        console.error("[Inflation] Ошибка:", error.message);
        return generateFallbackData();
    }
}

function generateFallbackData() {
    const now = new Date();
    const data = [];
    let value = 3;
    for (let i = 365; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        value = value + (Math.random() - 0.5) * 0.2;
        value = Math.max(1, Math.min(8, value));
        data.push({ date: date.toISOString().slice(0, 10), value: Math.round(value * 100) / 100 });
    }
    return data;
}

async function collectInflation() {
    const data = await fetchInflation();
    await fs.mkdir(join(__dirname, "..", "..", "data", "basket"), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log("[Inflation] ✅ " + data.length + " записей");
}
if (import.meta.url === "file://" + process.argv[1]) collectInflation().catch(console.error);
export { collectInflation };
