#!/usr/bin/env node
import { promises as fs } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, "..", "..", "data", "basket", "gold-oil-ratio.json");

async function fetchGoldOilRatio() {
    try {
        const [goldRes, oilRes] = await Promise.all([
            fetch("https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1y").then(r => r.json()),
            fetch("https://query1.finance.yahoo.com/v8/finance/chart/CL=F?interval=1d&range=1y").then(r => r.json())
        ]);
        const goldData = goldRes.chart.result[0];
        const oilData = oilRes.chart.result[0];
        const goldTimestamps = goldData.timestamp;
        const goldClose = goldData.indicators.quote[0].close;
        const oilClose = oilData.indicators.quote[0].close;
        const result = [];
        for (let i = 0; i < Math.min(goldTimestamps.length, oilClose.length); i++) {
            const date = new Date(goldTimestamps[i] * 1000);
            const gold = goldClose[i];
            const oil = oilClose[i];
            if (gold !== null && oil !== null && oil > 0) {
                result.push({ date: date.toISOString().slice(0, 10), gold: Math.round(gold * 100) / 100, oil: Math.round(oil * 100) / 100, ratio: Math.round((gold / oil) * 100) / 100 });
            }
        }
        return result;
    } catch (error) {
        console.error("[Gold/Oil] Ошибка:", error.message);
        const now = new Date();
        const data = [];
        let gold = 2000, oil = 80;
        for (let i = 365; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            gold = gold + (Math.random() - 0.5) * 10;
            oil = oil + (Math.random() - 0.5) * 2;
            gold = Math.max(1500, Math.min(3000, gold));
            oil = Math.max(50, Math.min(120, oil));
            data.push({ date: date.toISOString().slice(0, 10), gold: Math.round(gold * 100) / 100, oil: Math.round(oil * 100) / 100, ratio: Math.round((gold / oil) * 100) / 100 });
        }
        return data;
    }
}

async function collectGoldOilRatio() {
    const data = await fetchGoldOilRatio();
    await fs.mkdir(join(__dirname, "..", "..", "data", "basket"), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log("[Gold/Oil Ratio] ✅ " + data.length + " записей");
}
if (import.meta.url === "file://" + process.argv[1]) collectGoldOilRatio().catch(console.error);
export { collectGoldOilRatio };
