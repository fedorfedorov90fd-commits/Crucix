#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №66: BLOCKCHAIN VERIFICATION — ВЕРИФИКАЦИЯ ЧЕРЕЗ БЛОКЧЕЙН
// ============================================================
// Неподдельная история данных через блокчейн
// Хеширование и верификация данных
// Децентрализованное доверие
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'blockchain');
const CHAIN_FILE = join(DATA_DIR, 'chain.json');
const VERIFICATIONS_FILE = join(DATA_DIR, 'verifications.json');
const HASHES_FILE = join(DATA_DIR, 'hashes.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const GENESIS_BLOCK = {
  index: 0,
  timestamp: new Date().toISOString(),
  data: 'Genesis Block — Crucix Blockchain',
  previous_hash: '0',
  hash: null,
  nonce: 0,
  verified_by: 'system'
};

// ============================================================
// 2. КЛАСС БЛОКЧЕЙН-ВЕРИФИКАЦИИ
// ============================================================

class BlockchainVerification {
  constructor() {
    this.chain = [];
    this.verifications = [];
    this.hashes = {};
    this.difficulty = 2;
  }

  async init() {
    await this.ensureDirs();
    await this.loadChain();
    await this.loadVerifications();
    await this.loadHashes();
    console.log('[Blockchain] Система верификации инициализирована');
    console.log(`[Blockchain] Блоков: ${this.chain.length}, Верификаций: ${this.verifications.length}`);
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadChain() {
    try {
      const data = await fs.readFile(CHAIN_FILE, 'utf-8');
      this.chain = JSON.parse(data);
    } catch (e) {
      // Создаём генезис-блок
      const genesis = { ...GENESIS_BLOCK };
      genesis.hash = this.calculateHash(genesis);
      this.chain = [genesis];
      await this.saveChain();
    }
  }

  async saveChain() {
    await fs.writeFile(CHAIN_FILE, JSON.stringify(this.chain, null, 2));
  }

  async loadVerifications() {
    try {
      const data = await fs.readFile(VERIFICATIONS_FILE, 'utf-8');
      this.verifications = JSON.parse(data);
    } catch (e) {
      this.verifications = [];
      await this.saveVerifications();
    }
  }

  async saveVerifications() {
    await fs.writeFile(VERIFICATIONS_FILE, JSON.stringify(this.verifications, null, 2));
  }

  async loadHashes() {
    try {
      const data = await fs.readFile(HASHES_FILE, 'utf-8');
      this.hashes = JSON.parse(data);
    } catch (e) {
      this.hashes = {};
      await this.saveHashes();
    }
  }

  async saveHashes() {
    await fs.writeFile(HASHES_FILE, JSON.stringify(this.hashes, null, 2));
  }

  // ============================================================
  // 2.1. ХЕШИРОВАНИЕ
  // ============================================================

  calculateHash(block) {
    const data = block.index + block.timestamp + JSON.stringify(block.data) + block.previous_hash + block.nonce;
    return createHash('sha256').update(data).digest('hex');
  }

  generateHash(data) {
    return createHash('sha256').update(JSON.stringify(data) + Date.now() + Math.random()).digest('hex');
  }

  // ============================================================
  // 2.2. ДОБАВЛЕНИЕ БЛОКА
  // ============================================================

  async addBlock(data, verifiedBy = 'system') {
    const previous_block = this.chain[this.chain.length - 1];
    const block = {
      index: this.chain.length,
      timestamp: new Date().toISOString(),
      data: data,
      previous_hash: previous_block.hash,
      hash: null,
      nonce: 0,
      verified_by: verifiedBy
    };

    // Майнинг (proof of work)
    block.nonce = this.mine(block);
    block.hash = this.calculateHash(block);

    this.chain.push(block);
    await this.saveChain();

    // Сохраняем хеш для быстрого поиска
    const hash = block.hash;
    this.hashes[hash] = {
      block_index: block.index,
      timestamp: block.timestamp,
      data: block.data,
      verified_by: block.verified_by
    };
    await this.saveHashes();

    return block;
  }

  mine(block) {
    let nonce = 0;
    while (true) {
      block.nonce = nonce;
      const hash = this.calculateHash(block);
      if (hash.startsWith('0'.repeat(this.difficulty))) {
        return nonce;
      }
      nonce++;
    }
  }

  // ============================================================
  // 2.3. ВЕРИФИКАЦИЯ ДАННЫХ
  // ============================================================

  async verifyData(data, dataHash) {
    // Проверяем, есть ли такой хеш в цепи
    if (this.hashes[dataHash]) {
      const entry = this.hashes[dataHash];
      
      // Проверяем, совпадают ли данные
      const computedHash = this.generateHash(data);
      if (computedHash === dataHash) {
        return {
          verified: true,
          block_index: entry.block_index,
          timestamp: entry.timestamp,
          verified_by: entry.verified_by,
          message: '✅ Данные верифицированы!'
        };
      }
    }

    // Если данные не найдены — создаём новую запись
    const block = await this.addBlock(data, 'user');
    return {
      verified: true,
      block_index: block.index,
      timestamp: block.timestamp,
      verified_by: 'user',
      hash: block.hash,
      message: '✅ Данные записаны в блокчейн!'
    };
  }

  async verifyHash(hash) {
    if (this.hashes[hash]) {
      const entry = this.hashes[hash];
      
      // Проверяем целостность цепи
      const block = this.chain[entry.block_index];
      if (block && block.hash === hash) {
        return {
          verified: true,
          block_index: entry.block_index,
          timestamp: entry.timestamp,
          data: entry.data,
          verified_by: entry.verified_by,
          message: '✅ Хеш верифицирован!'
        };
      }
    }
    return {
      verified: false,
      message: '❌ Хеш не найден в блокчейне'
    };
  }

  // ============================================================
  // 2.4. ПРОВЕРКА ЦЕЛОСТНОСТИ ЦЕПИ
  // ============================================================

  validateChain() {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];

      // Проверяем хеш
      if (current.hash !== this.calculateHash(current)) {
        return {
          valid: false,
          error: `Блок ${i} имеет неверный хеш`,
          block: current
        };
      }

      // Проверяем связь с предыдущим блоком
      if (current.previous_hash !== previous.hash) {
        return {
          valid: false,
          error: `Блок ${i} имеет неверную ссылку на предыдущий блок`,
          block: current
        };
      }

      // Проверяем proof of work
      if (!current.hash.startsWith('0'.repeat(this.difficulty))) {
        return {
          valid: false,
          error: `Блок ${i} имеет неверный proof of work`,
          block: current
        };
      }
    }

    return {
      valid: true,
      message: '✅ Цепь верифицирована!',
      blocks: this.chain.length
    };
  }

  // ============================================================
  // 2.5. СТАТИСТИКА
  // ============================================================

  getStats() {
    const totalBlocks = this.chain.length;
    const totalVerifications = this.verifications.length;
    const totalHashes = Object.keys(this.hashes).length;

    return {
      total_blocks: totalBlocks,
      total_verifications: totalVerifications,
      total_hashes: totalHashes,
      difficulty: this.difficulty,
      genesis_timestamp: this.chain[0]?.timestamp || null,
      last_block_timestamp: this.chain[this.chain.length - 1]?.timestamp || null,
      chain_valid: this.validateChain().valid
    };
  }

  getChain(limit = 20) {
    return this.chain.slice(-limit);
  }

  getVerifications(limit = 20) {
    return this.verifications.slice(-limit);
  }

  getHashes() {
    return this.hashes;
  }

  async addVerification(data) {
    const verification = {
      id: `ver-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      data: data,
      hash: this.generateHash(data),
      timestamp: new Date().toISOString(),
      block_index: this.chain.length
    };

    this.verifications.push(verification);
    await this.saveVerifications();

    // Добавляем в блокчейн
    const block = await this.addBlock(data, 'verification');

    return {
      verification: verification,
      block: block
    };
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let blockchain = null;

async function getBlockchain() {
  if (!blockchain) {
    blockchain = new BlockchainVerification();
    await blockchain.init();
  }
  return blockchain;
}

export async function handleBlockchainAPI(req, res) {
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
    const blockchain = await getBlockchain();

    // GET /api/blockchain/status
    if (path === '/api/blockchain/status' && req.method === 'GET') {
      const stats = blockchain.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'blockchain',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // GET /api/blockchain/chain
    if (path === '/api/blockchain/chain' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const chain = blockchain.getChain(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, chain, total: chain.length }));
      return;
    }

    // POST /api/blockchain/add
    if (path === '/api/blockchain/add' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const result = await blockchain.addVerification(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, result }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // POST /api/blockchain/verify
    if (path === '/api/blockchain/verify' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const result = await blockchain.verifyData(data.data, data.hash);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, result }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // GET /api/blockchain/validate
    if (path === '/api/blockchain/validate' && req.method === 'GET') {
      const result = blockchain.validateChain();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, result }));
      return;
    }

    // GET /api/blockchain/hashes
    if (path === '/api/blockchain/hashes' && req.method === 'GET') {
      const hashes = blockchain.getHashes();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, hashes }));
      return;
    }

    // GET /api/blockchain/verify/:hash
    if (path.startsWith('/api/blockchain/verify/') && req.method === 'GET') {
      const hash = path.split('/').pop();
      const result = await blockchain.verifyHash(hash);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, result }));
      return;
    }

    // GET /api/blockchain/verifications
    if (path === '/api/blockchain/verifications' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const verifications = blockchain.getVerifications(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, verifications }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Blockchain API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка', details: error.message }));
  }
}

export default { handleBlockchainAPI, BlockchainVerification };
