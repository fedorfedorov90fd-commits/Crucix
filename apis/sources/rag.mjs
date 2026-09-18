import { spawn } from 'child_process';
const RAG_SCRIPT = "/home/ta8_/Рабочий стол/Crucix/scripts/rag_pipeline.py";

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const query = url.searchParams.get('query') || 'Что происходит в мире киберугроз?';
    const proc = spawn('/home/ta8_/Рабочий стол/Crucix/venv/bin/python', [RAG_SCRIPT, 'query', query], {
      cwd: "/home/ta8_/Рабочий стол/Crucix"
    });
    let output = '';
    proc.stdout.on('data', d => output += d);
    proc.stderr.on('data', d => output += d);
    proc.on('close', code => {
      if (code === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ answer: output.trim() }));
      } else {
        res.writeHead(500);
        res.end(JSON.stringify({ error: output }));
      }
    });
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
