// apis/predict/ws_v4_patch.mjs
// Патч для ws.mjs — добавление v4 endpoints
//
// В ws.mjs добавьте импорт:
//   import { handlePluginsAPI } from './plugins_api.mjs';
//   import { loadOrCreateVAPIDKeys, SubscriptionStore, createPushHandlers } from '../../dashboard/pwa/push.js';
//
// В createServer callback, перед основной логикой:
//
//   // v4 endpoints
//   const vapidKeys = loadOrCreateVAPIDKeys();
//   const pushStore = new SubscriptionStore();
//   const pushHandlers = createPushHandlers(vapidKeys, pushStore);
//
//   if (url.pathname.startsWith('/api/plugins')) {
//     await handlePluginsAPI(req, res, url);
//     return;
//   }
//
//   if (url.pathname === '/api/push/vapid-key') return pushHandlers.getVapidKey(req, res);
//   if (url.pathname === '/api/push/subscribe' && req.method === 'POST') {
//     return await pushHandlers.subscribe(req, res);
//   }
//   if (url.pathname === '/api/push/unsubscribe' && req.method === 'POST') {
//     return await pushHandlers.unsubscribe(req, res);
//   }
//   if (url.pathname === '/api/push/test' && req.method === 'POST') {
//     return await pushHandlers.test(req, res);
//   }

export const WS_V4_PATCH = `
Добавьте в ws.mjs:

import { handlePluginsAPI } from './plugins_api.mjs';
import { loadOrCreateVAPIDKeys, SubscriptionStore, createPushHandlers } from '../../dashboard/pwa/push.js';

// Внутри createServer callback:
const vapidKeys = loadOrCreateVAPIDKeys();
const pushStore = new SubscriptionStore();
const pushHandlers = createPushHandlers(vapidKeys, pushStore);

// Перед общей логикой:
if (url.pathname.startsWith('/api/plugins')) {
  await handlePluginsAPI(req, res, url);
  return;
}

if (url.pathname === '/api/push/vapid-key') return pushHandlers.getVapidKey(req, res);
if (url.pathname === '/api/push/subscribe' && req.method === 'POST') return await pushHandlers.subscribe(req, res);
if (url.pathname === '/api/push/unsubscribe' && req.method === 'POST') return await pushHandlers.unsubscribe(req, res);
if (url.pathname === '/api/push/test' && req.method === 'POST') return await pushHandlers.test(req, res);
`;
