import fs from 'fs';

const ROUTES_FILE = 'server/routes-api.json';
const MODULES_FILE = 'server/modules.json';

const route = { path: '/api/layers/entity-graph', module: 'entity-graph-api', method: 'GET' };
const moduleRec = { id: 'entity-graph-api', path: './apis/sources/entity-graph-api' };

// routes-api.json
const routes = JSON.parse(fs.readFileSync(ROUTES_FILE, 'utf8'));
const hasRoute = routes.some(r => r.path === route.path);
if (hasRoute) {
  console.log('Маршрут уже существует:', route.path);
} else {
  routes.push(route);
  fs.writeFileSync(ROUTES_FILE, JSON.stringify(routes, null, 2), 'utf8');
  console.log('Добавлен маршрут:', JSON.stringify(route));
}

// modules.json
const modules = JSON.parse(fs.readFileSync(MODULES_FILE, 'utf8'));
const hasModule = modules.some(m => m.id === moduleRec.id);
if (hasModule) {
  console.log('Модуль уже существует:', moduleRec.id);
} else {
  modules.push(moduleRec);
  fs.writeFileSync(MODULES_FILE, JSON.stringify(modules, null, 2), 'utf8');
  console.log('Добавлен модуль:', JSON.stringify(moduleRec));
}

console.log('Итого маршрутов:', routes.length);
console.log('Итого модулей:', modules.length);
