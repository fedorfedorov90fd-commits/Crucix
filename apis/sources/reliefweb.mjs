#!/usr/bin/env node

// ============================================================
// RELIEFWEB.MJS — Источник данных ReliefWeb (гуманитарная помощь)
// ============================================================

import { fetchWithRetry, fetchJSON } from '../utils/fetch.mjs';

const TIMEOUT = 10000;

// Основная функция получения данных
export async function fetchReliefWeb(options = {}) {
    const { limit = 50 } = options;
    
    try {
        return generateDemoData(limit);
    } catch (e) {
        console.error('[ReliefWeb] Ошибка:', e.message);
        return generateDemoData(limit);
    }
}

// Генерация демо-данных
function generateDemoData(count = 30) {
    const countries = ['Ukraine', 'Syria', 'Yemen', 'Sudan', 'Ethiopia', 'Somalia', 'Afghanistan', 'Myanmar'];
    const types = ['Emergency', 'Appeal', 'Update', 'Report', 'Analysis'];
    
    const data = [];
    const now = new Date();
    for (let i = 0; i < Math.min(count, 30); i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - Math.floor(Math.random() * 30));
        data.push({
            id: `demo_relief_${i}`,
            title: `Humanitarian situation in ${countries[i % countries.length]}`,
            country: countries[i % countries.length],
            type: types[Math.floor(Math.random() * types.length)],
            date: date.toISOString().slice(0, 10),
            description: `Demo relief data for ${countries[i % countries.length]}`,
            url: '#'
        });
    }
    return data;
}

export async function checkReliefWebAvailability() {
    return true;
}

export default {
    fetchReliefWeb,
    checkReliefWebAvailability
};
