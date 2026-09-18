#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №62: QUANTUM OSINT — КВАНТОВЫЙ АНАЛИЗ
// ============================================================
// Квантовые алгоритмы для OSINT-анализа
// Суперпозиция вероятностей событий
// Квантовая запутанность между индикаторами
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'quantum');
const STATES_FILE = join(DATA_DIR, 'states.json');
const ENTANGLEMENTS_FILE = join(DATA_DIR, 'entanglements.json');
const MEASUREMENTS_FILE = join(DATA_DIR, 'measurements.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ КВАНТОВЫХ СОСТОЯНИЙ
// ============================================================

const QUANTUM_STATES = [
  {
    id: 'conflict',
    name: 'Конфликтный потенциал',
    probability: 0.35,
    superposition: ['escalation', 'de-escalation', 'status_quo'],
    amplitudes: [0.6, 0.2, 0.2],
    entangled_with: ['economy', 'military', 'diplomacy']
  },
  {
    id: 'economy',
    name: 'Экономическая стабильность',
    probability: 0.45,
    superposition: ['growth', 'recession', 'stagnation'],
    amplitudes: [0.3, 0.5, 0.2],
    entangled_with: ['conflict', 'energy', 'markets']
  },
  {
    id: 'military',
    name: 'Военная активность',
    probability: 0.30,
    superposition: ['high', 'medium', 'low'],
    amplitudes: [0.4, 0.4, 0.2],
    entangled_with: ['conflict', 'diplomacy', 'intelligence']
  },
  {
    id: 'diplomacy',
    name: 'Дипломатические отношения',
    probability: 0.55,
    superposition: ['improving', 'deteriorating', 'stable'],
    amplitudes: [0.2, 0.5, 0.3],
    entangled_with: ['conflict', 'military', 'economy']
  },
  {
    id: 'energy',
    name: 'Энергетическая безопасность',
    probability: 0.40,
    superposition: ['secure', 'vulnerable', 'crisis'],
    amplitudes: [0.3, 0.4, 0.3],
    entangled_with: ['economy', 'diplomacy', 'climate']
  },
  {
    id: 'climate',
    name: 'Климатические риски',
    probability: 0.25,
    superposition: ['critical', 'moderate', 'low'],
    amplitudes: [0.5, 0.3, 0.2],
    entangled_with: ['energy', 'economy', 'natural']
  },
  {
    id: 'markets',
    name: 'Рыночная волатильность',
    probability: 0.50,
    superposition: ['high', 'medium', 'low'],
    amplitudes: [0.4, 0.4, 0.2],
    entangled_with: ['economy', 'energy', 'conflict']
  },
  {
    id: 'intelligence',
    name: 'Разведывательная активность',
    probability: 0.28,
    superposition: ['high', 'medium', 'low'],
    amplitudes: [0.3, 0.5, 0.2],
    entangled_with: ['military', 'conflict', 'diplomacy']
  }
];

// ============================================================
// 2. КЛАСС КВАНТОВОГО АНАЛИЗА
// ============================================================

class QuantumOSINT {
  constructor() {
    this.states = [];
    this.entanglements = [];
    this.measurements = [];
    this.observers = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadStates();
    await this.loadEntanglements();
    await this.loadMeasurements();
    console.log('[Quantum] Квантовая OSINT-система инициализирована');
    console.log(`[Quantum] Состояний: ${this.states.length}, Запутанностей: ${this.entanglements.length}`);
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadStates() {
    try {
      const data = await fs.readFile(STATES_FILE, 'utf-8');
      this.states = JSON.parse(data);
    } catch (e) {
      this.states = QUANTUM_STATES;
      await this.saveStates();
    }
  }

  async saveStates() {
    await fs.writeFile(STATES_FILE, JSON.stringify(this.states, null, 2));
  }

  async loadEntanglements() {
    try {
      const data = await fs.readFile(ENTANGLEMENTS_FILE, 'utf-8');
      this.entanglements = JSON.parse(data);
    } catch (e) {
      this.entanglements = this.calculateEntanglements();
      await this.saveEntanglements();
    }
  }

  async saveEntanglements() {
    await fs.writeFile(ENTANGLEMENTS_FILE, JSON.stringify(this.entanglements, null, 2));
  }

  async loadMeasurements() {
    try {
      const data = await fs.readFile(MEASUREMENTS_FILE, 'utf-8');
      this.measurements = JSON.parse(data);
    } catch (e) {
      this.measurements = [];
      await this.saveMeasurements();
    }
  }

  async saveMeasurements() {
    await fs.writeFile(MEASUREMENTS_FILE, JSON.stringify(this.measurements, null, 2));
  }

  // ============================================================
  // 2.1. КВАНТОВАЯ ЗАПУТАННОСТЬ
  // ============================================================

  calculateEntanglements() {
    const entanglements = [];
    const pairs = [];

    // Создаём пары состояний
    for (let i = 0; i < this.states.length; i++) {
      for (let j = i + 1; j < this.states.length; j++) {
        const stateA = this.states[i];
        const stateB = this.states[j];
        
        // Проверяем, связаны ли они
        if (stateA.entangled_with.includes(stateB.id) || stateB.entangled_with.includes(stateA.id)) {
          // Квантовая корреляция (симуляция)
          const correlation = 0.3 + Math.random() * 0.6;
          const entanglementStrength = Math.round(correlation * 100);
          
          pairs.push({
            state_a: stateA.id,
            state_b: stateB.id,
            correlation: Math.round(correlation * 100),
            entanglement: entanglementStrength,
            description: `Квантовая запутанность между ${stateA.name} и ${stateB.name}`,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    return pairs;
  }

  // ============================================================
  // 2.2. СУПЕРПОЗИЦИЯ СОСТОЯНИЙ
  // ============================================================

  getSuperposition(stateId) {
    const state = this.states.find(s => s.id === stateId);
    if (!state) return null;

    const result = {
      id: state.id,
      name: state.name,
      probability: state.probability,
      states: []
    };

    // Формируем суперпозицию с амплитудами
    for (let i = 0; i < state.superposition.length; i++) {
      // Моделируем коллапс волновой функции (случайный выбор)
      const collapsed = Math.random() < state.amplitudes[i];
      result.states.push({
        name: state.superposition[i],
        amplitude: state.amplitudes[i],
        probability: Math.round(state.amplitudes[i] * 100),
        collapsed: collapsed
      });
    }

    return result;
  }

  // ============================================================
  // 2.3. КВАНТОВЫЙ КОЛЛАПС (ИЗМЕРЕНИЕ)
  // ============================================================

  async collapseState(stateId, observer = 'system') {
    const state = this.states.find(s => s.id === stateId);
    if (!state) return null;

    // Вычисляем коллапс (случайный выбор на основе амплитуд)
    const random = Math.random();
    let cumulative = 0;
    let selectedIndex = 0;

    for (let i = 0; i < state.amplitudes.length; i++) {
      cumulative += state.amplitudes[i];
      if (random < cumulative) {
        selectedIndex = i;
        break;
      }
    }

    const collapsedState = state.superposition[selectedIndex];
    const amplitude = state.amplitudes[selectedIndex];

    // Сохраняем измерение
    const measurement = {
      id: `measure-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      state_id: state.id,
      state_name: state.name,
      collapsed_state: collapsedState,
      amplitude: amplitude,
      probability: Math.round(amplitude * 100),
      observer: observer,
      timestamp: new Date().toISOString()
    };

    this.measurements.push(measurement);
    if (this.measurements.length > 100) {
      this.measurements = this.measurements.slice(-100);
    }
    await this.saveMeasurements();

    return measurement;
  }

  // ============================================================
  // 2.4. КВАНТОВАЯ ИНТЕРФЕРЕНЦИЯ
  // ============================================================

  calculateInterference(stateAId, stateBId) {
    const stateA = this.states.find(s => s.id === stateAId);
    const stateB = this.states.find(s => s.id === stateBId);
    
    if (!stateA || !stateB) return null;

    // Вычисляем интерференцию между состояниями
    const probA = stateA.probability;
    const probB = stateB.probability;
    const entanglement = this.entanglements.find(
      e => (e.state_a === stateAId && e.state_b === stateBId) ||
           (e.state_a === stateBId && e.state_b === stateAId)
    );

    // Конструктивная или деструктивная интерференция
    const interferenceType = (probA + probB) > 1 ? 'constructive' : 'destructive';
    const interferenceStrength = entanglement ? entanglement.entanglement / 100 : 0.3;
    const combinedProb = (probA + probB) * (1 + (interferenceType === 'constructive' ? 0.2 : -0.2));

    return {
      state_a: stateAId,
      state_b: stateBId,
      interference_type: interferenceType,
      strength: Math.round(interferenceStrength * 100),
      combined_probability: Math.min(Math.round(combinedProb * 100), 100),
      description: `${interferenceType === 'constructive' ? '➕ Конструктивная' : '➖ Деструктивная'} интерференция между ${stateA.name} и ${stateB.name}`
    };
  }

  // ============================================================
  // 2.5. КВАНТОВЫЙ АНАЛИЗ ВСЕХ СОСТОЯНИЙ
  // ============================================================

  quantumAnalysis() {
    const results = {
      timestamp: new Date().toISOString(),
      states: [],
      entanglements: [],
      interferences: [],
      summary: {}
    };

    // Анализ каждого состояния
    for (const state of this.states) {
      const superposition = this.getSuperposition(state.id);
      results.states.push({
        id: state.id,
        name: state.name,
        probability: state.probability,
        superposition: superposition.states,
        entangled_with: state.entangled_with
      });
    }

    // Анализ запутанностей
    for (const ent of this.entanglements) {
      results.entanglements.push({
        pair: `${ent.state_a} ⇄ ${ent.state_b}`,
        correlation: ent.correlation,
        entanglement: ent.entanglement
      });
    }

    // Анализ интерференций (выборочно)
    const pairs = [];
    for (let i = 0; i < this.states.length; i++) {
      for (let j = i + 1; j < this.states.length; j++) {
        if (i < 3 && j < 5) { // Ограничиваем для производительности
          const inter = this.calculateInterference(this.states[i].id, this.states[j].id);
          if (inter) pairs.push(inter);
        }
      }
    }
    results.interferences = pairs;

    // Сводка
    const avgProb = this.states.reduce((sum, s) => sum + s.probability, 0) / this.states.length;
    const avgEntanglement = this.entanglements.reduce((sum, e) => sum + e.entanglement, 0) / this.entanglements.length || 0;

    results.summary = {
      total_states: this.states.length,
      total_entanglements: this.entanglements.length,
      average_probability: Math.round(avgProb * 100),
      average_entanglement: Math.round(avgEntanglement),
      measurements_count: this.measurements.length,
      quantum_state: avgProb > 0.5 ? 'superposition' : 'collapsed'
    };

    return results;
  }

  // ============================================================
  // 2.6. ПРОГНОЗ НА ОСНОВЕ КВАНТОВОГО АНАЛИЗА
  // ============================================================

  quantumPrediction() {
    const analysis = this.quantumAnalysis();
    const predictions = [];

    // Для каждого состояния предсказываем коллапс
    for (const state of this.states) {
      const collapsed = this.getSuperposition(state.id);
      const mostLikely = collapsed.states.reduce((a, b) => 
        a.probability > b.probability ? a : b
      );

      predictions.push({
        state: state.name,
        most_likely: mostLikely.name,
        probability: mostLikely.probability,
        confidence: Math.min(70 + Math.random() * 25, 95)
      });
    }

    return {
      timestamp: new Date().toISOString(),
      predictions: predictions,
      quantum_entropy: Math.round((1 - analysis.summary.average_entanglement / 100) * 100),
      recommendation: this.generateRecommendation(predictions)
    };
  }

  generateRecommendation(predictions) {
    const critical = predictions.filter(p => p.probability > 70 && p.most_likely.includes('high'));
    const warnings = predictions.filter(p => p.probability > 50 && p.most_likely.includes('medium'));

    if (critical.length > 0) {
      return `🔴 КРИТИЧЕСКОЕ: ${critical.map(p => p.state).join(', ')} требуют немедленного внимания. Квантовый коллапс предсказывает высокую вероятность неблагоприятных событий.`;
    } else if (warnings.length > 0) {
      return `🟡 ПРЕДУПРЕЖДЕНИЕ: ${warnings.map(p => p.state).join(', ')} находятся в квантовой суперпозиции. Рекомендуется усилить мониторинг.`;
    } else {
      return `🟢 КВАНТОВАЯ СТАБИЛЬНОСТЬ: Система находится в устойчивом состоянии. Вероятность неблагоприятных событий низкая.`;
    }
  }

  // ============================================================
  // 2.7. СТАТИСТИКА
  // ============================================================

  getStats() {
    const analysis = this.quantumAnalysis();
    return {
      total_states: this.states.length,
      total_entanglements: this.entanglements.length,
      total_measurements: this.measurements.length,
      average_probability: analysis.summary.average_probability,
      average_entanglement: analysis.summary.average_entanglement,
      quantum_state: analysis.summary.quantum_state,
      last_measurement: this.measurements.length > 0 ? this.measurements[this.measurements.length - 1].timestamp : null
    };
  }

  getStates() {
    return this.states;
  }

  getEntanglements() {
    return this.entanglements;
  }

  getMeasurements(limit = 20) {
    return this.measurements.slice(-limit);
  }

  getState(id) {
    return this.states.find(s => s.id === id);
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let quantum = null;

async function getQuantum() {
  if (!quantum) {
    quantum = new QuantumOSINT();
    await quantum.init();
  }
  return quantum;
}

export async function handleQuantumAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    const quantum = await getQuantum();

    // GET /api/quantum/status
    if (path === '/api/quantum/status' && req.method === 'GET') {
      const stats = quantum.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'quantum',
        status: 'online',
        version: '1.0',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // GET /api/quantum/states
    if (path === '/api/quantum/states' && req.method === 'GET') {
      const states = quantum.getStates();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, states }));
      return;
    }

    // GET /api/quantum/state/:id
    if (path.startsWith('/api/quantum/state/') && req.method === 'GET') {
      const id = path.split('/').pop();
      const state = quantum.getState(id);
      if (state) {
        const superposition = quantum.getSuperposition(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, state, superposition }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Состояние не найдено' }));
      }
      return;
    }

    // POST /api/quantum/collapse/:id
    if (path.startsWith('/api/quantum/collapse/') && req.method === 'POST') {
      const id = path.split('/').pop();
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const measurement = await quantum.collapseState(id, data.observer || 'system');
          if (measurement) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, measurement }));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Состояние не найдено' }));
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // GET /api/quantum/entanglements
    if (path === '/api/quantum/entanglements' && req.method === 'GET') {
      const entanglements = quantum.getEntanglements();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, entanglements }));
      return;
    }

    // GET /api/quantum/analysis
    if (path === '/api/quantum/analysis' && req.method === 'GET') {
      const analysis = quantum.quantumAnalysis();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, analysis }));
      return;
    }

    // GET /api/quantum/prediction
    if (path === '/api/quantum/prediction' && req.method === 'GET') {
      const prediction = quantum.quantumPrediction();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, prediction }));
      return;
    }

    // GET /api/quantum/measurements
    if (path === '/api/quantum/measurements' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const measurements = quantum.getMeasurements(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, measurements }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Quantum API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка', details: error.message }));
  }
}

export default { handleQuantumAPI, QuantumOSINT };
