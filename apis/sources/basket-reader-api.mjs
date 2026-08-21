import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = join(process.cwd(), 'data', 'basket');

export async function handleBasketReaderAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // /api/basket/:filename
  const match = pathname.match(/^\/api\/basket\/(.+\.json)$/);
  if (!match) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid basket request' }));
    return;
  }

  const filename = match[1];
  const filePath = join(BASKET_DIR, filename);

  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `File not found: ${filename}` }));
    return;
  }

  try {
    const data = readFileSync(filePath, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(data);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}
