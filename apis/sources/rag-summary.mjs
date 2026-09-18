import { readFile } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';

const RAG_SCRIPT = join(process.cwd(), 'scripts/rag_pipeline.py');

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const source = url.searchParams.get('source') || 'all';
    
    const proc = spawn('/home/ta8_/Рабочий стол/Crucix/venv/bin/python', [RAG_SCRIPT, 'query', `Сделай краткое резюме последних событий из источника ${source}`], {
      cwd: "/home/ta8_/Рабочий стол/Crucix"
    });
    
    let output = '';
    proc.stdout.on('data', d => output += d);
    proc.stderr.on('data', d => output += d);
    proc.on('close', code => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        summary: output.trim(),
        source: source,
        timestamp: new Date().toISOString()
      }));
    });
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
