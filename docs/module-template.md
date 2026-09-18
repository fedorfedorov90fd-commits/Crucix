# ШАБЛОН МОДУЛЯ

## Сборщик (scripts/collect-{name}.mjs)
import { promises as fs } from 'fs';
const BASKET_FILE = 'data/basket/{name}.json';
async function collect() {
  const data = await fetch('https://api.example.com/data');
  await fs.writeFile(BASKET_FILE, JSON.stringify({ data, date: new Date() }));
}
collect();

## API (apis/sources/{name}.mjs)
export async function handle{Name}API(req, res) {
  const data = await fs.readFile('data/basket/{name}.json');
  res.json(JSON.parse(data));
}
