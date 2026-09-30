// ═══════════════════════════════════════════════════════════════
//  CRUCIX RECON SIDECAR v1.0.0
//  Локальный HTTP-сервер на порту 3121.
//  Выполняет сетевые операции: DNS, WHOIS(RDAP), SSL/TLS, TCP port scan, banner grab.
//  Запускается отдельным процессом: node core/recon-sidecar.mjs
// ═══════════════════════════════════════════════════════════════

import { createServer } from 'node:http';
import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns/promises';
import { URL } from 'node:url';

const PORT = parseInt(process.env.CRUCIX_SIDECAR_PORT || '3121', 10);
const CACHE_TTL_MS = 3600000;
const cache = new Map();

function cacheGet(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) { cache.delete(key); return null; }
  return e.value;
}

function cacheSet(key, value) {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  setTimeout(() => cache.delete(key), CACHE_TTL_MS).unref();
}

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

const SERVICE_GUESS = {
  21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS',
  80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS', 445: 'SMB',
  993: 'IMAPS', 995: 'POP3S', 1433: 'MSSQL', 1521: 'Oracle',
  3306: 'MySQL', 3389: 'RDP', 5432: 'PostgreSQL', 5900: 'VNC',
  6379: 'Redis', 8080: 'HTTP-Alt', 8443: 'HTTPS-Alt',
  9200: 'Elasticsearch', 27017: 'MongoDB',
};

async function scanPort(host, port, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(timeoutMs);
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('timeout', () => { sock.destroy(); resolve(false); });
    sock.once('error', () => { sock.destroy(); resolve(false); });
    sock.connect(port, host);
  });
}

async function portScan(host, ports) {
  const tasks = ports.map(async (p) => ({ port: p, open: await scanPort(host, p) }));
  const results = await Promise.all(tasks);
  return {
    host,
    scanned: ports.length,
    open: results.filter(r => r.open).length,
    closed: results.filter(r => !r.open).length,
    results: results.map(r => ({ port: r.port, state: r.open ? 'open' : 'closed', service: SERVICE_GUESS[r.port] || null })),
    openPorts: results.filter(r => r.open).map(r => ({ port: r.port, service: SERVICE_GUESS[r.port] || null })),
  };
}

async function dnsLookup(domain) {
  const records = {};
  const types = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA'];
  for (const t of types) {
    try {
      const r = await dns.resolve(domain, t);
      if (r && r.length > 0) records[t] = r;
    } catch { /* нет записей такого типа */ }
  }
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(domain)) {
    try { records.PTR = await dns.reverse(domain); } catch {}
  }
  return { domain, records, hasRecords: Object.keys(records).length > 0 };
}

async function whoisLookup(domain) {
  const tld = domain.split('.').pop().toLowerCase();
  const bootstrap = {
    com: 'https://rdap.verisign.com/com/v1/domain/',
    net: 'https://rdap.verisign.com/net/v1/domain/',
  };
  const url = (bootstrap[tld] || 'https://rdap.org/domain/') + domain;
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/rdap+json' }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return { error: `RDAP HTTP ${r.status}`, domain };
    const data = await r.json();
    const events = data.events || [];
    const reg = events.find(e => e.eventAction === 'registration');
    const exp = events.find(e => e.eventAction === 'expiration');
    const entities = (data.entities || []).map(e => ({
      role: e.roles?.[0],
      handle: e.handle,
      name: e.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3],
      org: e.vcardArray?.[1]?.find(v => v[0] === 'org')?.[3],
    }));
    return {
      domain,
      registrar: entities.find(e => e.role === 'registrar')?.name || entities.find(e => e.role === 'registrar')?.org || null,
      registrationDate: reg?.eventDate || null,
      expirationDate: exp?.eventDate || null,
      status: data.status || [],
      nameservers: (data.nameservers || []).map(ns => ns.ldhName),
      entities,
    };
  } catch (e) {
    return { error: e.message, domain };
  }
}

async function sslInspect(host, port = 443) {
  return new Promise((resolve) => {
    const sock = tls.connect({ host, port, rejectUnauthorized: false, servername: host }, () => {
      const cert = sock.getPeerCertificate();
      const result = {
        host, port,
        protocol: sock.getProtocol(),
        authorized: sock.authorized,
        cert: cert && Object.keys(cert).length > 0 ? {
          subject: cert.subject,
          issuer: cert.issuer,
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          serialNumber: cert.serialNumber,
          fingerprint256: cert.fingerprint256,
          altNames: (cert.subjectaltname || '').split(', ').map(n => n.replace(/^DNS:/, '')),
          selfSigned: cert.issuer?.CN === cert.subject?.CN,
        } : null,
        cipher: sock.getCipher(),
      };
      sock.destroy();
      resolve(result);
    });
    sock.setTimeout(8000);
    sock.on('timeout', () => { sock.destroy(); resolve({ error: 'timeout', host, port }); });
    sock.on('error', (e) => { sock.destroy(); resolve({ error: e.message, host, port }); });
  });
}

async function bannerGrab(host, port) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let buf = '';
    sock.setTimeout(4000);
    sock.on('connect', () => {
      if (port === 80 || port === 8080) sock.write(`HEAD / HTTP/1.0\r\nHost: ${host}\r\n\r\n`);
    });
    sock.on('data', (d) => {
      buf += d.toString();
      if (buf.length > 1024) { sock.destroy(); resolve({ host, port, banner: buf.slice(0, 1024) }); }
    });
    sock.on('timeout', () => { sock.destroy(); resolve({ host, port, banner: buf || null }); });
    sock.on('error', (e) => { sock.destroy(); resolve({ error: e.message, host, port }); });
    sock.on('close', () => { if (buf) resolve({ host, port, banner: buf }); });
    sock.connect(port, host);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  const params = Object.fromEntries(url.searchParams);

  if (path === '/health') return json(res, 200, { ok: true, uptime: process.uptime(), cacheSize: cache.size });

  const key = path + url.search;
  const cached = cacheGet(key);
  if (cached) return json(res, 200, { ...cached, cached: true });

  try {
    let result;
    if (path === '/dns') {
      if (!params.domain) throw new Error('domain required');
      result = await dnsLookup(params.domain);
    } else if (path === '/whois') {
      if (!params.domain) throw new Error('domain required');
      result = await whoisLookup(params.domain);
    } else if (path === '/ssl') {
      if (!params.host) throw new Error('host required');
      result = await sslInspect(params.host, parseInt(params.port) || 443);
    } else if (path === '/portscan') {
      if (!params.host) throw new Error('host required');
      const ports = (params.ports || '21,22,23,25,53,80,110,143,443,445,993,995,1433,3306,3389,5432,5900,6379,8080,8443,9200,27017')
        .split(',').map(p => parseInt(p)).filter(p => p > 0 && p <= 65535);
      result = await portScan(params.host, ports);
    } else if (path === '/banner') {
      if (!params.host || !params.port) throw new Error('host and port required');
      result = await bannerGrab(params.host, parseInt(params.port));
    } else {
      return json(res, 404, { error: 'Not found', path });
    }
    cacheSet(key, result);
    return json(res, 200, result);
  } catch (e) {
    return json(res, 400, { error: e.message });
  }
});

export function startReconSidecar(port = PORT) {
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      console.log(`  RECON Sidecar: http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startReconSidecar();
}
