// dashboard/pwa/push.js
// Server-side: отправка push-уведомлений через Web Push Protocol
//
// Реализовано на чистом Node.js с использованием криптографии
// (без web-push npm-пакета).

import { createECDH, createHmac, createCipheriv, randomBytes, sign, createPrivateKey } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUSH_DIR = join(__dirname, '..', '..', 'runs', 'pwa');
const SUBSCRIPTIONS_FILE = join(PUSH_DIR, 'subscriptions.json');
const VAPID_FILE = join(PUSH_DIR, 'vapid.json');

export function generateVAPIDKeys() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();

  const publicKey = ecdh.getPublicKey();
  const privateKey = ecdh.getPrivateKey();

  const publicKeyB64 = publicKey.toString('base64url');
  const privateKeyB64 = privateKey.toString('base64url');

  return {
    publicKey: publicKeyB64,
    privateKey: privateKeyB64,
  };
}

export function loadOrCreateVAPIDKeys() {
  if (existsSync(VAPID_FILE)) {
    try {
      return JSON.parse(readFileSync(VAPID_FILE, 'utf-8'));
    } catch {}
  }

  const keys = generateVAPIDKeys();

  if (!existsSync(PUSH_DIR)) mkdirSync(PUSH_DIR, { recursive: true });
  writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2));

  return keys;
}

export class SubscriptionStore {
  constructor() {
    this.subscriptions = this._load();
  }

  _load() {
    if (!existsSync(SUBSCRIPTIONS_FILE)) return {};
    try {
      return JSON.parse(readFileSync(SUBSCRIPTIONS_FILE, 'utf-8'));
    } catch {
      return {};
    }
  }

  _save() {
    if (!existsSync(PUSH_DIR)) mkdirSync(PUSH_DIR, { recursive: true });
    writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(this.subscriptions, null, 2));
  }

  add(subscription) {
    if (!subscription.endpoint) return { ok: false, error: 'no_endpoint' };

    this.subscriptions[subscription.endpoint] = {
      ...subscription,
      addedAt: new Date().toISOString(),
    };
    this._save();

    return { ok: true, total: Object.keys(this.subscriptions).length };
  }

  remove(endpoint) {
    delete this.subscriptions[endpoint];
    this._save();
    return { ok: true };
  }

  list() {
    return Object.values(this.subscriptions);
  }

  count() {
    return Object.keys(this.subscriptions).length;
  }
}

function hkdfExtract(salt, ikm) {
  return createHmac('sha256', salt).update(ikm).digest();
}

function hkdfExpand(prk, info, length) {
  const blocks = Math.ceil(length / 32);
  let output = Buffer.alloc(0);
  let T = Buffer.alloc(0);

  for (let i = 1; i <= blocks; i++) {
    const hmac = createHmac('sha256', prk);
    hmac.update(T);
    hmac.update(info);
    hmac.update(Buffer.from([i]));
    T = hmac.digest();
    output = Buffer.concat([output, T]);
  }

  return output.slice(0, length);
}

export async function sendWebPush(subscription, payload, vapidKeys, options = {}) {
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return { ok: false, error: 'invalid_subscription' };
  }

  const audience = new URL(endpoint).origin;

  const payloadBuffer = Buffer.from(JSON.stringify(payload), 'utf-8');

  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();

  const clientPublicKey = Buffer.from(keys.p256dh, 'base64url');
  const authSecret = Buffer.from(keys.auth, 'base64url');

  const sharedSecret = ecdh.computeSecret(clientPublicKey);

  const authInfo = Buffer.concat([
    Buffer.from('WebPush: info\0'),
    clientPublicKey,
    ecdh.getPublicKey(),
  ]);
  const prk = hkdfExtract(authSecret, sharedSecret);
  const ikm = hkdfExpand(prk, authInfo, 32);

  const salt = randomBytes(16);

  const cekInfo = Buffer.from('Content-Encoding: aes128gcm\0');
  const nonceInfo = Buffer.from('Content-Encoding: nonce\0');

  const prk2 = hkdfExtract(salt, ikm);
  const cek = hkdfExpand(prk2, cekInfo, 16);
  const nonce = hkdfExpand(prk2, nonceInfo, 12);

  const paddedPayload = Buffer.concat([payloadBuffer, Buffer.from([0x02])]);
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([cipher.update(paddedPayload), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096);

  const serverPublicKey = ecdh.getPublicKey();

  const body = Buffer.concat([
    salt,
    recordSize,
    Buffer.from([serverPublicKey.length]),
    serverPublicKey,
    encrypted,
    authTag,
  ]);

  const jwt = createVAPIDJWT(audience, vapidKeys, options.subject);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': String(options.ttl || 86400),
        'Authorization': `vapid t=${jwt}, k=${vapidKeys.publicKey}`,
        'Urgency': options.urgency || 'normal',
      },
      body,
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function broadcastPush(payload, vapidKeys, store, options = {}) {
  const subscriptions = store.list();
  const results = [];

  for (const sub of subscriptions) {
    const result = await sendWebPush(sub, payload, vapidKeys, options);
    results.push({ endpoint: sub.endpoint, ...result });

    if (result.status === 404 || result.status === 410) {
      store.remove(sub.endpoint);
    }
  }

  return {
    sent: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    total: subscriptions.length,
    results,
  };
}

function createVAPIDJWT(audience, vapidKeys, subject = 'mailto:admin@crucix.local') {
  const header = {
    typ: 'JWT',
    alg: 'ES256',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  };

  const encodeB64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

  const headerB64 = encodeB64(header);
  const payloadB64 = encodeB64(payload);
  const unsigned = `${headerB64}.${payloadB64}`;

  const privateKeyBuffer = Buffer.from(vapidKeys.privateKey, 'base64url');

  const privateKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from('308141020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420', 'hex'),
      privateKeyBuffer,
    ]),
    format: 'der',
    type: 'pkcs8',
  });

  const signature = sign('sha256', Buffer.from(unsigned), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });

  const signatureB64 = signature.toString('base64url');

  return `${unsigned}.${signatureB64}`;
}

export function createPushHandlers(vapidKeys, store) {
  return {
    getVapidKey: (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ publicKey: vapidKeys.publicKey }));
    },

    subscribe: async (req, res) => {
      const body = await readBody(req);
      try {
        const subscription = JSON.parse(body);
        const result = store.add(subscription);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    },

    unsubscribe: async (req, res) => {
      const body = await readBody(req);
      try {
        const { endpoint } = JSON.parse(body);
        const result = store.remove(endpoint);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    },

    test: async (req, res) => {
      const result = await broadcastPush({
        title: 'Crucix Test',
        body: 'Test push notification',
        icon: '/pwa/icons/icon-192.png',
      }, vapidKeys, store);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    },
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export async function notifyPush(result, store, vapidKeys) {
  const cr = result.compositeRisk;
  if (!cr) return { skipped: true };

  if (cr.level !== 'high' && cr.level !== 'critical') {
    return { skipped: true, reason: 'low_priority' };
  }

  const payload = {
    title: `Crucix: ${cr.level.toUpperCase()}`,
    body: `Composite risk: ${cr.composite.toFixed(3)} - ${cr.topDrivers?.[0]?.name || ''}`,
    icon: '/pwa/icons/icon-192.png',
    badge: '/pwa/icons/icon-96.png',
    type: 'alert',
    level: cr.level,
    url: '/crucix.html',
  };

  return await broadcastPush(payload, vapidKeys, store, {
    urgency: cr.level === 'critical' ? 'high' : 'normal',
    ttl: cr.level === 'critical' ? 3600 : 86400,
  });
}

export const PUSH_INFO = {
  name: 'Web Push',
  description: 'Push notifications via Web Push Protocol (RFC 8291)',
  requiresVAPID: true,
};
