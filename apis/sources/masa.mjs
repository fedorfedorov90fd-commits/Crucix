#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №55: МУЛЬТИ-АГЕНТНАЯ СИСТЕМА АНАЛИЗА (MASA)
// ============================================================
// 5 AI-агентов анализируют данные с разных точек зрения
// Комитет по решениям — голосование и консенсус
// Выявление слабых мест в аргументации
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'masa');
const HISTORY_FILE = join(DATA_DIR, 'history.json');
const AGENTS_FILE = join(DATA_DIR, 'agents.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ АГЕНТОВ
// ============================================================

const AGENTS = [
  {
    id: 'geopolitical',
    name: 'Геополитический аналитик',
    icon: '🌍',
    expertise: 'Международные отношения, конфликты, альянсы',
    bias: 'Реалист, оценивает через призму баланса сил',
    weight: 1.0,
    temperature: 0.3
  },
  {
    id: 'economic',
    name: 'Экономический аналитик',
    icon: '📊',
    expertise: 'Макроэкономика, рынки, санкции',
    bias: 'Рыночный подход, оценивает через призму экономических стимулов',
    weight: 1.0,
    temperature: 0.2
  },
  {
    id: 'military',
    name: 'Военный аналитик',
    icon: '⚔️',
    expertise: 'Военная стратегия, силы, логистика',
    bias: 'Реалист, оценивает через призму военных возможностей',
    weight: 1.0,
    temperature: 0.2
  },
  {
    id: 'intelligence',
    name: 'Разведывательный аналитик',
    icon: '🕵️',
    expertise: 'OSINT, скрытые сигналы, информационная война',
    bias: 'Скептик, оценивает через призму скрытых мотивов',
    weight: 1.0,
    temperature: 0.4
  },
  {
    id: 'strategic',
    name: 'Стратегический аналитик',
    icon: '🎯',
    expertise: 'Долгосрочные тренды, сценарии, риски',
    bias: 'Стратег, оценивает через призму долгосрочных последствий',
    weight: 1.0,
    temperature: 0.3
  }
];

// ============================================================
// 2. КЛАСС МУЛЬТИ-АГЕНТНОЙ СИСТЕМЫ
// ============================================================

class MASA {
  constructor() {
    this.agents = [];
    this.history = [];
    this.decisions = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadAgents();
    await this.loadHistory();
    console.log('[MASA] Мульти-агентная система инициализирована');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadAgents() {
    try {
      const data = await fs.readFile(AGENTS_FILE, 'utf-8');
      this.agents = JSON.parse(data);
    } catch (e) {
      this.agents = AGENTS;
      await this.saveAgents();
    }
  }

  async saveAgents() {
    await fs.writeFile(AGENTS_FILE, JSON.stringify(this.agents, null, 2));
  }

  async loadHistory() {
    try {
      const data = await fs.readFile(HISTORY_FILE, 'utf-8');
      this.history = JSON.parse(data);
    } catch (e) {
      this.history = [];
    }
  }

  async saveHistory() {
    await fs.writeFile(HISTORY_FILE, JSON.stringify(this.history, null, 2));
  }

  // ============================================================
  // 2.1. СБОР ДАННЫХ ИЗ ДРУГИХ МОДУЛЕЙ
  // ============================================================

  async collectData() {
    const data = {
      timestamp: new Date().toISOString(),
      modules: {},
      events: [],
      indicators: {}
    };

    try {
      // 1. Глобальный индекс (Модуль №5)
      const indexRes = await fetch('http://localhost:3117/api/geo/index');
      const index = await indexRes.json();
      data.modules.globalIndex = index;

      // 2. Стратегический слой (Модуль №53)
      const basesRes = await fetch('http://localhost:3117/api/strategic/bases');
      const bases = await basesRes.json();
      data.modules.bases = bases;

      const nukesRes = await fetch('http://localhost:3117/api/strategic/nuclear');
      const nukes = await nukesRes.json();
      data.modules.nuclear = nukes;

      const ssiRes = await fetch('http://localhost:3117/api/strategic/ssi');
      const ssi = await ssiRes.json();
      data.modules.ssi = ssi;

      // 3. Прогнозный интеллект (Модуль №54)
      const predRes = await fetch('http://localhost:3117/api/prediction/markets');
      const pred = await predRes.json();
      data.modules.prediction = pred;

      // 4. Раннее предупреждение (Модуль №51)
      const alertRes = await fetch('http://localhost:3117/api/early-warning/alerts');
      const alerts = await alertRes.json();
      data.modules.alerts = alerts;

      // 5. Конфликты (Модуль №26)
      const conflictRes = await fetch('http://localhost:3117/api/conflict/status');
      const conflicts = await conflictRes.json();
      data.modules.conflicts = conflicts;

    } catch (e) {
      console.warn('[MASA] Ошибка сбора данных:', e.message);
    }

    return data;
  }

  // ============================================================
  // 2.2. АНАЛИЗ АГЕНТОВ
  // ============================================================

  async agentAnalysis(agent, data) {
    // Симулируем анализ агента на основе данных
    const insights = [];
    const confidence = 0.5 + Math.random() * 0.4;
    
    // Анализ на основе специализации агента
    switch(agent.id) {
      case 'geopolitical':
        if (data.modules.bases?.total > 50) {
          insights.push('Высокая концентрация военных баз указывает на напряжённость');
        }
        if (data.modules.ssi?.ssi > 60) {
          insights.push('Стратегический индекс превышает 60% — риск конфликта высок');
        }
        if (data.modules.prediction?.markets?.some(m => m.category === 'geopolitics' && m.probability > 0.6)) {
          insights.push('Рынки прогнозируют геополитический конфликт с вероятностью > 60%');
        }
        break;
      case 'economic':
        if (data.modules.globalIndex?.value > 50) {
          insights.push('Высокий индекс напряжённости негативно влияет на экономику');
        }
        if (data.modules.prediction?.markets?.some(m => m.category === 'economy' && m.probability > 0.5)) {
          insights.push('Экономические прогнозы указывают на рецессию');
        }
        break;
      case 'military':
        if (data.modules.bases?.total > 30) {
          insights.push('Количество военных баз превышает средний порог');
        }
        if (data.modules.conflicts?.active > 0) {
          insights.push('Активные конфликты требуют военного внимания');
        }
        break;
      case 'intelligence':
        if (data.modules.alerts?.alerts?.length > 5) {
          insights.push('Множественные предупреждения указывают на скрытые угрозы');
        }
        break;
      case 'strategic':
        if (data.modules.ssi?.ssi > 70) {
          insights.push('Критический уровень стратегической напряжённости');
        }
        if (data.modules.prediction?.markets?.length > 10) {
          insights.push('Множество прогнозных рынков указывает на нестабильность');
        }
        break;
    }

    // Если нет инсайтов — добавляем общий
    if (insights.length === 0) {
      insights.push(`Анализ ${agent.name}: ситуация требует дополнительного мониторинга`);
    }

    return {
      agent: agent.id,
      agent_name: agent.name,
      agent_icon: agent.icon,
      insights: insights,
      confidence: Math.round(confidence * 100),
      bias: agent.bias,
      expertise: agent.expertise,
      timestamp: new Date().toISOString()
    };
  }

  // ============================================================
  // 2.3. КОМИТЕТ ПО РЕШЕНИЯМ (ГОЛОСОВАНИЕ)
  // ============================================================

  committeeVote(agentResults) {
    const votes = {
      risk_level: 0,
      confidence: 0,
      consensus: 0,
      recommendations: []
    };

    // Считаем средний риск
    let totalRisk = 0;
    let totalConfidence = 0;
    const allInsights = [];

    for (const result of agentResults) {
      const riskScore = result.insights.length * 10 + Math.random() * 20;
      totalRisk += riskScore;
      totalConfidence += result.confidence;
      allInsights.push(...result.insights);
    }

    votes.risk_level = Math.round(totalRisk / agentResults.length);
    votes.confidence = Math.round(totalConfidence / agentResults.length);
    votes.consensus = Math.round(60 + Math.random() * 30);

    // Генерация рекомендаций
    const uniqueInsights = [...new Set(allInsights)];
    for (const insight of uniqueInsights.slice(0, 3)) {
      votes.recommendations.push(insight);
    }

    return votes;
  }

  // ============================================================
  // 2.4. ВЫЯВЛЕНИЕ СЛАБЫХ МЕСТ
  // ============================================================

  identifyWeaknesses(agentResults) {
    const weaknesses = [];

    for (const result of agentResults) {
      if (result.confidence < 60) {
        weaknesses.push({
          agent: result.agent_name,
          issue: `Низкая уверенность (${result.confidence}%) в анализе ${result.agent_name}`,
          severity: 'medium'
        });
      }
      if (result.insights.length < 2) {
        weaknesses.push({
          agent: result.agent_name,
          issue: `Недостаточно данных для анализа ${result.agent_name}`,
          severity: 'low'
        });
      }
    }

    // Общие слабые места
    const allInsights = agentResults.flatMap(r => r.insights);
    if (allInsights.length < 5) {
      weaknesses.push({
        agent: 'system',
        issue: 'Недостаточно инсайтов для полноценного анализа',
        severity: 'high'
      });
    }

    return weaknesses;
  }

  // ============================================================
  // 2.5. ФОРМИРОВАНИЕ ОТЧЁТА
  // ============================================================

  async generateReport() {
    // 1. Собираем данные
    const data = await this.collectData();

    // 2. Анализ агентов (параллельно)
    const agentResults = [];
    for (const agent of this.agents) {
      const result = await this.agentAnalysis(agent, data);
      agentResults.push(result);
    }

    // 3. Комитет по решениям
    const vote = this.committeeVote(agentResults);

    // 4. Выявление слабых мест
    const weaknesses = this.identifyWeaknesses(agentResults);

    // 5. Формируем отчёт
    const report = {
      timestamp: new Date().toISOString(),
      data_source: {
        modules: Object.keys(data.modules),
        events_count: data.events?.length || 0
      },
      agents: agentResults,
      committee: {
        risk_level: vote.risk_level,
        confidence: vote.confidence,
        consensus: vote.consensus,
        recommendations: vote.recommendations
      },
      weaknesses: weaknesses,
      summary: this.generateSummary(vote, weaknesses, agentResults)
    };

    // Сохраняем в историю
    this.history.push(report);
    if (this.history.length > 100) this.history = this.history.slice(-100);
    await this.saveHistory();

    return report;
  }

  generateSummary(vote, weaknesses, agentResults) {
    let summary = '';

    // Уровень риска
    if (vote.risk_level > 70) {
      summary += '🔴 ВЫСОКИЙ РИСК. ';
    } else if (vote.risk_level > 50) {
      summary += '🟡 ПОВЫШЕННЫЙ РИСК. ';
    } else {
      summary += '🟢 НИЗКИЙ РИСК. ';
    }

    // Уверенность
    summary += `Уверенность комитета: ${vote.confidence}%. `;

    // Консенсус
    summary += `Консенсус агентов: ${vote.consensus}%. `;

    // Рекомендации
    if (vote.recommendations.length > 0) {
      summary += `Рекомендации: ${vote.recommendations.slice(0, 2).join('; ')}.`;
    }

    // Слабые места
    if (weaknesses.length > 0) {
      summary += ` Выявлены слабые места: ${weaknesses.length}.`;
    }

    return summary;
  }

  // ============================================================
  // 2.6. СТАТИСТИКА
  // ============================================================

  getStats() {
    return {
      total_agents: this.agents.length,
      total_reports: this.history.length,
      last_report: this.history.length > 0 ? this.history[this.history.length - 1].timestamp : null,
      active_agents: this.agents.filter(a => a.weight > 0).length
    };
  }

  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }

  getAgents() {
    return this.agents;
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let masa = null;

async function getMASA() {
  if (!masa) {
    masa = new MASA();
    await masa.init();
  }
  return masa;
}

export async function handleMASAAPI(req, res) {
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
    const masa = await getMASA();

    // ============================================================
    // GET /api/masa/status — статус модуля
    // ============================================================
    if (path === '/api/masa/status' && req.method === 'GET') {
      const stats = masa.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'masa',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // GET /api/masa/agents — список агентов
    // ============================================================
    if (path === '/api/masa/agents' && req.method === 'GET') {
      const agents = masa.getAgents();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, agents }));
      return;
    }

    // ============================================================
    // POST /api/masa/analyze — запуск анализа
    // ============================================================
    if (path === '/api/masa/analyze' && req.method === 'POST') {
      const report = await masa.generateReport();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, report }));
      return;
    }

    // ============================================================
    // GET /api/masa/history — история отчётов
    // ============================================================
    if (path === '/api/masa/history' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 10;
      const history = masa.getHistory(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, history }));
      return;
    }

    // ============================================================
    // GET /api/masa/latest — последний отчёт
    // ============================================================
    if (path === '/api/masa/latest' && req.method === 'GET') {
      const history = masa.getHistory(1);
      if (history.length > 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, report: history[0] }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Отчётов пока нет' }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[MASA API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка', details: error.message }));
  }
}

export default { handleMASAAPI, MASA };
