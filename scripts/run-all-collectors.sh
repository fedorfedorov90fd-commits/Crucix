#!/bin/bash
# ============================================================
# RUN-ALL-COLLECTORS.SH — Запуск всех сборщиков
# ============================================================
# Запускается по cron каждый час
# Логи пишутся в logs/collectors.log
# ============================================================

cd "/home/ta8_/Рабочий стол/Crucix"

echo "=== $(date) ===" >> logs/collectors.log
echo "Запуск сборщиков..." >> logs/collectors.log

# Основные сборщики
node scripts/collect-notam.mjs >> logs/collectors.log 2>&1
node scripts/collect-gps-jamming.mjs >> logs/collectors.log 2>&1
node scripts/collect-google-trends.mjs >> logs/collectors.log 2>&1
node scripts/collect-vix.mjs >> logs/collectors.log 2>&1
node scripts/collect-yield-curve.mjs >> logs/collectors.log 2>&1
node scripts/collect-gold-oil-ratio.mjs >> logs/collectors.log 2>&1
node scripts/collect-copper-gold.mjs >> logs/collectors.log 2>&1
node scripts/collect-bdi.mjs >> logs/collectors.log 2>&1
node scripts/collect-viirs.mjs >> logs/collectors.log 2>&1
node scripts/collect-uranium.mjs >> logs/collectors.log 2>&1
node scripts/collect-big-mac.mjs >> logs/collectors.log 2>&1
node scripts/collect-debt-gdp.mjs >> logs/collectors.log 2>&1
node scripts/collect-sp500-vix.mjs >> logs/collectors.log 2>&1
node scripts/collect-crypto-fear.mjs >> logs/collectors.log 2>&1
node scripts/collect-oil-gas.mjs >> logs/collectors.log 2>&1
node scripts/collect-gold-silver.mjs >> logs/collectors.log 2>&1
node scripts/collect-happiness.mjs >> logs/collectors.log 2>&1
node scripts/collect-big-mac-alt.mjs >> logs/collectors.log 2>&1
node scripts/collect-big-mac-main.mjs >> logs/collectors.log 2>&1
node scripts/collect-vxx.mjs >> logs/collectors.log 2>&1
node scripts/collect-happiness-alt.mjs >> logs/collectors.log 2>&1
node scripts/collect-inflation.mjs >> logs/collectors.log 2>&1
node scripts/collect-unemployment.mjs >> logs/collectors.log 2>&1
node scripts/collect-pmi.mjs >> logs/collectors.log 2>&1
node scripts/collect-recession.mjs >> logs/collectors.log 2>&1
node scripts/collect-dxy.mjs >> logs/collectors.log 2>&1
node scripts/collect-tips.mjs >> logs/collectors.log 2>&1
node scripts/collect-ovx.mjs >> logs/collectors.log 2>&1
node scripts/collect-hy-spread.mjs >> logs/collectors.log 2>&1
node scripts/collect-war-preparation.mjs >> logs/collectors.log 2>&1
node scripts/collect-consumer-confidence.mjs >> logs/collectors.log 2>&1
node scripts/collect-nuclear-monitor.mjs >> logs/collectors.log 2>&1
node scripts/collect-social-unrest.mjs >> logs/collectors.log 2>&1

echo "✅ Сбор завершён" >> logs/collectors.log
echo "" >> logs/collectors.log
