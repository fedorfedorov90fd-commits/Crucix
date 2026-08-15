#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №14: КИБЕРИНТЕЛЛЕКТ И МОНИТОРИНГ УГРОЗ
// ============================================================

// ============================================================
// 1. ДЕМО-ДАННЫЕ
// ============================================================

const DEMO_THREATS = [
    {
        id: 'threat-001',
        name: 'LockBit Ransomware',
        type: 'ransomware',
        severity: 'critical',
        status: 'active',
        actor: 'LockBit Gang',
        description: 'Ransomware-as-a-service targeting enterprise networks',
        targets: ['Healthcare', 'Manufacturing', 'Government'],
        firstSeen: '2026-08-10',
        lastSeen: '2026-08-14',
        iocs: ['185.xxx.xxx.xxx', 'malware-lockbit.exe'],
        confidence: 92
    },
    {
        id: 'threat-002',
        name: 'APT28 (Fancy Bear)',
        type: 'apt',
        severity: 'high',
        status: 'active',
        actor: 'APT28',
        description: 'Russian state-sponsored cyber espionage group',
        targets: ['Government', 'Military', 'Energy'],
        firstSeen: '2026-08-05',
        lastSeen: '2026-08-14',
        iocs: ['76.xxx.xxx.xxx', 'apt28-phishing.doc'],
        confidence: 88
    },
    {
        id: 'threat-003',
        name: 'BlackCat Ransomware',
        type: 'ransomware',
        severity: 'high',
        status: 'active',
        actor: 'BlackCat Group',
        description: 'Ransomware gang using double extortion tactics',
        targets: ['Finance', 'Technology', 'Education'],
        firstSeen: '2026-08-08',
        lastSeen: '2026-08-13',
        iocs: ['192.xxx.xxx.xxx', 'blackcat.exe'],
        confidence: 85
    },
    {
        id: 'threat-004',
        name: 'ProxyLogon Exploit',
        type: 'exploit',
        severity: 'critical',
        status: 'active',
        actor: 'Unknown',
        description: 'Microsoft Exchange Server vulnerability exploited in the wild',
        targets: ['Email Servers', 'Government', 'Corporate'],
        firstSeen: '2026-08-01',
        lastSeen: '2026-08-14',
        iocs: ['CVE-2026-12345', 'exploit-proxylogon.py'],
        confidence: 95
    },
    {
        id: 'threat-005',
        name: 'QakBot Malware',
        type: 'malware',
        severity: 'medium',
        status: 'active',
        actor: 'QakBot Group',
        description: 'Banking trojan and information stealer',
        targets: ['Finance', 'Banking', 'Corporate'],
        firstSeen: '2026-08-03',
        lastSeen: '2026-08-12',
        iocs: ['104.xxx.xxx.xxx', 'qakbot.dll'],
        confidence: 80
    },
    {
        id: 'threat-006',
        name: 'Log4j Exploitation',
        type: 'exploit',
        severity: 'high',
        status: 'active',
        actor: 'Multiple',
        description: 'Remote code execution vulnerability in Log4j library',
        targets: ['Enterprise Applications', 'Cloud Services'],
        firstSeen: '2026-07-25',
        lastSeen: '2026-08-14',
        iocs: ['CVE-2026-44228', 'log4j-exploit.jar'],
        confidence: 90
    }
];

const DEMO_CVES = [
    {
        id: 'CVE-2026-12345',
        title: 'Microsoft Exchange Server RCE',
        description: 'Remote Code Execution vulnerability in Microsoft Exchange Server',
        severity: 'critical',
        cvssScore: 9.8,
        published: '2026-08-01',
        updated: '2026-08-14',
        exploited: true,
        vendor: 'Microsoft',
        product: 'Exchange Server'
    },
    {
        id: 'CVE-2026-67890',
        title: 'Apache Log4j RCE',
        description: 'Remote Code Execution in Apache Log4j library',
        severity: 'critical',
        cvssScore: 9.5,
        published: '2026-07-20',
        updated: '2026-08-14',
        exploited: true,
        vendor: 'Apache',
        product: 'Log4j'
    },
    {
        id: 'CVE-2026-54321',
        title: 'WordPress Plugin Vuln',
        description: 'SQL Injection in popular WordPress plugin',
        severity: 'high',
        cvssScore: 8.2,
        published: '2026-08-05',
        updated: '2026-08-13',
        exploited: false,
        vendor: 'WordPress',
        product: 'WP Plugin'
    },
    {
        id: 'CVE-2026-11111',
        title: 'Kubernetes API Server RCE',
        description: 'Remote Code Execution in Kubernetes API Server',
        severity: 'critical',
        cvssScore: 9.0,
        published: '2026-07-28',
        updated: '2026-08-12',
        exploited: true,
        vendor: 'Kubernetes',
        product: 'API Server'
    },
    {
        id: 'CVE-2026-22222',
        title: 'Windows Print Spooler Exploit',
        description: 'Privilege Escalation in Windows Print Spooler',
        severity: 'high',
        cvssScore: 8.0,
        published: '2026-08-02',
        updated: '2026-08-10',
        exploited: true,
        vendor: 'Microsoft',
        product: 'Windows'
    },
    {
        id: 'CVE-2026-33333',
        title: 'OpenSSL Vulnerability',
        description: 'Buffer Overflow in OpenSSL library',
        severity: 'critical',
        cvssScore: 9.2,
        published: '2026-07-15',
        updated: '2026-08-14',
        exploited: false,
        vendor: 'OpenSSL',
        product: 'OpenSSL'
    }
];

const DEMO_ACTORS = [
    {
        id: 'actor-001',
        name: 'LockBit Gang',
        type: 'ransomware-group',
        origin: 'Russia',
        active: true,
        firstSeen: '2020-01-01',
        lastSeen: '2026-08-14',
        targets: ['Healthcare', 'Manufacturing', 'Government'],
        motivation: 'financial',
        capabilities: ['Ransomware', 'Double Extortion'],
        confidence: 90
    },
    {
        id: 'actor-002',
        name: 'APT28',
        type: 'state-actor',
        origin: 'Russia',
        active: true,
        firstSeen: '2014-01-01',
        lastSeen: '2026-08-14',
        targets: ['Government', 'Military', 'Energy'],
        motivation: 'espionage',
        capabilities: ['Spear Phishing', 'Malware', 'VPN Exploits'],
        confidence: 88
    },
    {
        id: 'actor-003',
        name: 'BlackCat Group',
        type: 'ransomware-group',
        origin: 'Russia',
        active: true,
        firstSeen: '2021-01-01',
        lastSeen: '2026-08-13',
        targets: ['Finance', 'Technology', 'Education'],
        motivation: 'financial',
        capabilities: ['Ransomware', 'Data Theft'],
        confidence: 85
    },
    {
        id: 'actor-004',
        name: 'APT41',
        type: 'state-actor',
        origin: 'China',
        active: true,
        firstSeen: '2015-01-01',
        lastSeen: '2026-08-12',
        targets: ['Technology', 'Healthcare', 'Defense'],
        motivation: 'espionage',
        capabilities: ['Supply Chain Attacks', 'Malware', 'Cloud Exploits'],
        confidence: 82
    },
    {
        id: 'actor-005',
        name: 'Darkside Group',
        type: 'ransomware-group',
        origin: 'Russia',
        active: true,
        firstSeen: '2020-08-01',
        lastSeen: '2026-08-10',
        targets: ['Energy', 'Finance', 'Infrastructure'],
        motivation: 'financial',
        capabilities: ['Ransomware', 'Data Leak'],
        confidence: 80
    }
];

const DEMO_IOCS = [
    { id: 'ioc-001', type: 'ip', value: '185.234.56.78', threat: 'LockBit', risk: 'high', firstSeen: '2026-08-10' },
    { id: 'ioc-002', type: 'ip', value: '76.123.45.67', threat: 'APT28', risk: 'high', firstSeen: '2026-08-05' },
    { id: 'ioc-003', type: 'ip', value: '192.168.1.100', threat: 'BlackCat', risk: 'medium', firstSeen: '2026-08-08' },
    { id: 'ioc-004', type: 'domain', value: 'malware-c2.com', threat: 'QakBot', risk: 'high', firstSeen: '2026-08-03' },
    { id: 'ioc-005', type: 'hash', value: '5e8c7f6a4d3c2b1a0987654321fedcba', threat: 'LockBit', risk: 'critical', firstSeen: '2026-08-01' },
    { id: 'ioc-006', type: 'url', value: 'hxxp://evil-domain.com/payload', threat: 'APT28', risk: 'high', firstSeen: '2026-08-02' },
    { id: 'ioc-007', type: 'ip', value: '104.56.78.90', threat: 'QakBot', risk: 'medium', firstSeen: '2026-08-06' },
    { id: 'ioc-008', type: 'hash', value: 'a1b2c3d4e5f67890abcdef1234567890', threat: 'BlackCat', risk: 'high', firstSeen: '2026-08-07' }
];

// ============================================================
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function getThreats(params = {}) {
    let threats = [...DEMO_THREATS];
    if (params.severity) {
        threats = threats.filter(t => t.severity === params.severity);
    }
    if (params.type) {
        threats = threats.filter(t => t.type === params.type);
    }
    return threats;
}

function getCVEs(params = {}) {
    let cves = [...DEMO_CVES];
    if (params.severity) {
        cves = cves.filter(c => c.severity === params.severity);
    }
    if (params.exploited !== undefined) {
        cves = cves.filter(c => c.exploited === (params.exploited === 'true'));
    }
    return cves;
}

function getActors() {
    return DEMO_ACTORS;
}

function getIOCs() {
    return DEMO_IOCS;
}

function getStats() {
    const threats = DEMO_THREATS;
    const cves = DEMO_CVES;
    const actors = DEMO_ACTORS;
    const iocs = DEMO_IOCS;

    const severityCount = {};
    const typeCount = {};
    for (const t of threats) {
        if (!severityCount[t.severity]) severityCount[t.severity] = 0;
        severityCount[t.severity]++;
        if (!typeCount[t.type]) typeCount[t.type] = 0;
        typeCount[t.type]++;
    }

    const cveSeverity = {};
    for (const c of cves) {
        if (!cveSeverity[c.severity]) cveSeverity[c.severity] = 0;
        cveSeverity[c.severity]++;
    }

    return {
        totalThreats: threats.length,
        totalCVEs: cves.length,
        totalActors: actors.length,
        totalIOCs: iocs.length,
        activeThreats: threats.filter(t => t.status === 'active').length,
        exploitedCVEs: cves.filter(c => c.exploited).length,
        severityBreakdown: severityCount,
        typeBreakdown: typeCount,
        cveSeverity: cveSeverity,
        timestamp: new Date().toISOString()
    };
}

function getAlerts() {
    return [
        {
            id: 'alert-001',
            title: 'New LockBit Attack Detected',
            description: 'Ransomware attack targeting healthcare sector in US',
            severity: 'critical',
            timestamp: new Date().toISOString(),
            status: 'active',
            source: 'CISA'
        },
        {
            id: 'alert-002',
            title: 'APT28 Phishing Campaign',
            description: 'Phishing emails targeting government officials with malicious attachments',
            severity: 'high',
            timestamp: new Date().toISOString(),
            status: 'active',
            source: 'FBI'
        },
        {
            id: 'alert-003',
            title: 'New CVE-2026-12345 Exploitation',
            description: 'Mass exploitation of Exchange Server vulnerability observed',
            severity: 'critical',
            timestamp: new Date().toISOString(),
            status: 'active',
            source: 'CISA'
        },
        {
            id: 'alert-004',
            title: 'QakBot Malware Spike',
            description: 'Significant increase in QakBot malware distribution',
            severity: 'medium',
            timestamp: new Date().toISOString(),
            status: 'active',
            source: 'CERT'
        }
    ];
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleCyberAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        // --- GET /api/cyber/threats ---
        if (path === '/api/cyber/threats' && req.method === 'GET') {
            const params = new URLSearchParams(url.search);
            const threats = getThreats({
                severity: params.get('severity') || undefined,
                type: params.get('type') || undefined
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: threats.length,
                threats: threats,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/cyber/cves ---
        if (path === '/api/cyber/cves' && req.method === 'GET') {
            const params = new URLSearchParams(url.search);
            const cves = getCVEs({
                severity: params.get('severity') || undefined,
                exploited: params.get('exploited') || undefined
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: cves.length,
                cves: cves,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/cyber/actors ---
        if (path === '/api/cyber/actors' && req.method === 'GET') {
            const actors = getActors();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: actors.length,
                actors: actors,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/cyber/iocs ---
        if (path === '/api/cyber/iocs' && req.method === 'GET') {
            const iocs = getIOCs();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: iocs.length,
                iocs: iocs,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/cyber/alerts ---
        if (path === '/api/cyber/alerts' && req.method === 'GET') {
            const alerts = getAlerts();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: alerts.length,
                alerts: alerts,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/cyber/stats ---
        if (path === '/api/cyber/stats' && req.method === 'GET') {
            const stats = getStats();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                ...stats,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Неизвестный путь'
        }));

    } catch (error) {
        console.error('[Cyber API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default { handleCyberAPI };
