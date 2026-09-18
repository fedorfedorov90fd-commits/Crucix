import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';

const UPLOAD_DIR = join(process.cwd(), 'data/uploads');

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const method = req.method;
    
    if (method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const filename = data.filename || `doc_${Date.now()}.txt`;
          const content = data.content || '';
          const path = join(UPLOAD_DIR, filename);
          await writeFile(path, content);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, filename, path }));
        } catch(e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    } else if (method === 'GET') {
      const files = await readFile(UPLOAD_DIR).catch(() => []);
      const list = await Promise.all(files.map(async f => ({ name: f, size: (await readFile(join(UPLOAD_DIR, f))).length })));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files: list }));
    } else {
      res.writeHead(405);
      res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
