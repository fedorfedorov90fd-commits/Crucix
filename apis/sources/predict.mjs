import { readFile } from 'fs/promises';
import { join } from 'path';
const BASKET_PATH = join(process.cwd(), 'data/basket/predictions.json');

export default async function handler(req, res) {
  try {
    const data = JSON.parse(await readFile(BASKET_PATH, 'utf-8'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
