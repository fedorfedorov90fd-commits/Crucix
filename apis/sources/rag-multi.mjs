import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';

const RAG_SCRIPT = join(process.cwd(), 'scripts/rag_pipeline.py');
const MEMORY_FILE = join(process.cwd(), 'data/rag-memory.json');

async function getMemory(sessionId) {
  try {
    const data = JSON.parse(await readFile(MEMORY_FILE, 'utf-8'));
    return data[sessionId] || [];
  } catch { return []; }
}

async function saveMemory(sessionId, history) {
  try {
    const data = JSON.parse(await readFile(MEMORY_FILE, 'utf-8'));
    data[sessionId] = history;
    await writeFile(MEMORY_FILE, JSON.stringify(data, null, 2));
  } catch {
    await writeFile(MEMORY_FILE, JSON.stringify({ [sessionId]: history }, null, 2));
  }
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const query = url.searchParams.get('query') || '';
    const sessionId = url.searchParams.get('session') || 'default';
    
    if (!query) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Missing query' }));
    }
    
    const history = await getMemory(sessionId);
    const context = history.map(h => `User: ${h.user}\nAI: ${h.ai}`).join('\n');
    const fullQuery = context ? `${context}\nUser: ${query}` : query;
    
    const proc = spawn('/home/ta8_/Рабочий стол/Crucix/venv/bin/python', [RAG_SCRIPT, 'query', fullQuery], {
      cwd: "/home/ta8_/Рабочий стол/Crucix"
    });
    
    let output = '';
    proc.stdout.on('data', d => output += d);
    proc.stderr.on('data', d => output += d);
    proc.on('close', async code => {
      const answer = output.trim();
      history.push({ user: query, ai: answer });
      await saveMemory(sessionId, history.slice(-10));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ answer, history: history.slice(-5) }));
    });
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
