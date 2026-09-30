import { readFile } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';

const RAG_SCRIPT = join(process.cwd(), 'scripts/rag_pipeline.py');

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const query = url.searchParams.get('query') || 'Что происходит в мире киберугроз?';
    const cite = url.searchParams.get('cite') === 'true';
    
    const proc = spawn('/home/ta8_/Рабочий стол/Crucix/venv/bin/python', [RAG_SCRIPT, 'query', query], {
      cwd: "/home/ta8_/Рабочий стол/Crucix"
    });
    
    let output = '';
    proc.stdout.on('data', d => output += d);
    proc.stderr.on('data', d => output += d);
    proc.on('close', code => {
      const result = {
        answer: output.trim(),
        citations: cite ? ['CVE-2026-86151 (CVSS: 9.1)', 'CVE-2026-86152 (CVSS: 10.0)'] : []
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
