# Crucix PWA

Progressive Web App — установка Crucix на устройство с offline-режимом и push-уведомлениями.

## Возможности

- Install: добавление на домашний экран (mobile) или в док (desktop)
- Offline: caching predictions + dashboard работает без интернета
- Push notifications: критичные алерты приходят прямо на устройство
- Background sync: обновление прогнозов в фоне
- Shortcuts: быстрый доступ к Live Dashboard, Composite Risk, Plugins

## Установка

1. Откройте Crucix в браузере
2. Нажмите "Install" (появится баннер)
3. Подтвердите установку

Или через меню браузера:
- Chrome/Edge: "Установить приложение"
- Safari (iOS): "Добавить на главный экран"
- Firefox (Android): "Установить"

## Push-уведомления

Для получения push-уведомлений:

1. Установите PWA
2. Нажмите "Enable notifications" в настройках
3. Разрешите уведомления в браузере

Уведомления приходят при:
- composite risk > 0.5 (high/critical)
- Signal > 0.7
- Regime change detected

## Настройки

Откройте в PWA:
- Notifications: включить/выключить
- Types: какие типы получать (alerts, signals, regime changes)
- Quiet hours: не беспокоить в определённое время

## Offline режим

При отсутствии интернета:

- Показывается последний кэшированный прогноз
- История сигналов доступна
- Push придут при восстановлении связи
- Автоматический retry каждые 10 секунд

## Файлы

dashboard/pwa/
  manifest.json — PWA манифест
  service-worker.js — SW (caching + push + sync)
  install.js — install prompt + push subscription
  push.js — server-side Web Push sender
  offline.html — offline fallback page
  icons/ — иконки (72-512px)
    icon-72.png
    icon-96.png
    icon-128.png
    icon-144.png
    icon-152.png
    icon-192.png
    icon-384.png
    icon-512.png
  README.md

## Интеграция в dashboard

Добавьте в crucix.html перед </head>:

<link rel="manifest" href="/pwa/manifest.json">
<meta name="theme-color" content="#3b82f6">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="/pwa/icons/icon-192.png">

Перед </body>:

<script type="module" src="/pwa/install.js"></script>
<script>
  setTimeout(() => {
    console.log('PWA Status:', window.crucixPWA?.getStatus());
  }, 1000);
</script>

## Server integration

В engine.mjs:

import { loadOrCreateVAPIDKeys, SubscriptionStore, notifyPush, createPushHandlers } from './dashboard/pwa/push.js';

const vapidKeys = loadOrCreateVAPIDKeys();
const store = new SubscriptionStore();
const handlers = createPushHandlers(vapidKeys, store);

if (url.pathname === '/api/push/vapid-key') return handlers.getVapidKey(req, res);
if (url.pathname === '/api/push/subscribe') return handlers.subscribe(req, res);
if (url.pathname === '/api/push/unsubscribe') return handlers.unsubscribe(req, res);
if (url.pathname === '/api/push/test') return handlers.test(req, res);

await notifyPush(result, store, vapidKeys);

## VAPID keys

При первом запуске генерируется VAPID key pair и сохраняется в runs/pwa/vapid.json:

{
  "publicKey": "BEl62iUYgUivxIkv69yViEuiBIa...",
  "privateKey": "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49..."
}

Не теряйте — при потере все subscriptions перестанут работать.

## Поддерживаемые браузеры

| Browser | PWA Install | Push | Background Sync |
|---------|-------------|------|-----------------|
| Chrome 90+ | Да | Да | Да |
| Edge 90+ | Да | Да | Да |
| Firefox 90+ | Да | Да | Нет |
| Safari 16+ | Да | Да (iOS 16.4+) | Нет |
| Samsung Internet | Да | Да | Да |

## Zero-dependency

Web Push реализован на чистом Node.js через node:crypto:

- ECDH (prime256v1)
- HKDF (RFC 5869)
- AES-128-GCM
- VAPID JWT (ES256)

Без web-push npm-пакета, без jsonwebtoken.

## Troubleshooting

Push не приходят:
- Проверьте разрешения браузера
- Проверьте VAPID keys
- Проверьте endpoint в subscription (может быть устаревший)

PWA не устанавливается:
- Убедитесь, что открыто по HTTPS (или localhost)
- Проверьте manifest.json (валидность)
- Проверьте наличие всех icons

Offline не работает:
- Проверьте SW регистрацию (DevTools -> Application -> Service Workers)
- Проверьте Cache Storage
- Очистите кэш и переустановите
