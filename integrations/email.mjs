// integrations/email.mjs
// Email-интеграция: SMTP на чистом Node.js, без внешних зависимостей.
//
// Применение в Crucix:
//   Отправка алертов (compositeRisk level = high/critical) на почту
//   при превышении порогов композитного риска. Поддерживает
//   multipart/alternative (text+html), вложения, STARTTLS на порту 587.
//
// Особенности:
//   - Zero dependencies: только node:net, node:tls, node:crypto.
//   - STARTTLS на 587, implicit TLS на 465, plaintext на 25 (для локального relay).
//   - Честная машина состояний вместо привязки к номеру шага.
//   - HTML-экранирование в шаблоне письма (защита от XSS через имена драйверов).

import { createConnection } from 'node:net';
import { connect as tlsConnect } from 'node:tls';

// --- SMTP-КЛИЕНТ -----------------------------------

class SMTPClient {
  constructor({
    host = process.env.SMTP_HOST || 'localhost',
    port = parseInt(process.env.SMTP_PORT || '587'),
    secure = false,
    starttls = true,
    user = process.env.SMTP_USER,
    password = process.env.SMTP_PASSWORD,
    from = process.env.SMTP_FROM || 'crucix@localhost',
  } = {}) {
    this.host = host;
    this.port = port;
    this.secure = secure;         // true для порта 465 (implicit TLS)
    this.starttls = starttls;     // true для порта 587 (explicit TLS после EHLO)
    this.user = user;
    this.password = password;
    this.from = from;
    this.enabled = !!host;
  }

  async send({ to, subject, text, html, attachments = [] }) {
    if (!this.enabled) return { ok: false, error: 'smtp_not_configured' };

    const toList = Array.isArray(to) ? to : [to];
    const message = this._buildMessage({ from: this.from, to: toList, subject, text, html, attachments });

    return await this._runDialog(toList, message);
  }

  _runDialog(toList, message) {
    return new Promise((resolve) => {
      let socket;
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const connectFn = this.secure ? tlsConnect : createConnection;
      const connectOpts = this.secure
        ? { host: this.host, port: this.port, rejectUnauthorized: false }
        : { host: this.host, port: this.port };

      socket = connectFn(connectOpts, () => {});
      socket.setTimeout(10000);

      // Честная машина состояний
      // greeting -> ehlo -> [starttls] -> ehlo2 -> auth -> user -> pass -> mailfrom -> rcpt* -> data -> body -> quit
      const state = {
        name: 'greeting',
        rcptIndex: 0,
        toList,
      };

      let buffer = '';

      const respondTo = (code) => {
        switch (state.name) {
          case 'greeting':
            if (code.startsWith('2')) {
              state.name = 'ehlo';
              socket.write('EHLO crucix.local\r\n');
            } else {
              socket.end();
              done({ ok: false, error: 'greeting failed: ' + code });
            }
            break;

          case 'ehlo':
            if (code.startsWith('2')) {
              if (this.starttls && !this.secure) {
                state.name = 'starttls';
                socket.write('STARTTLS\r\n');
              } else if (this.user) {
                state.name = 'auth';
                socket.write('AUTH LOGIN\r\n');
              } else {
                state.name = 'mailfrom';
                socket.write('MAIL FROM:<' + this.from + '>\r\n');
              }
            } else {
              socket.end();
              done({ ok: false, error: 'ehlo failed: ' + code });
            }
            break;

          case 'starttls':
            if (code === '220') {
              // Апгрейд сокета до TLS
              const plain = socket;
              socket = tlsConnect({
                socket: plain,
                host: this.host,
                rejectUnauthorized: false,
              }, () => {
                state.name = 'ehlo2';
                socket.write('EHLO crucix.local\r\n');
              });
              socket.setTimeout(10000);
              this._attachHandlers(socket, respondTo, done, () => state.name);
            } else {
              socket.end();
              done({ ok: false, error: 'starttls failed: ' + code });
            }
            break;

          case 'ehlo2':
            if (code.startsWith('2')) {
              if (this.user) {
                state.name = 'auth';
                socket.write('AUTH LOGIN\r\n');
              } else {
                state.name = 'mailfrom';
                socket.write('MAIL FROM:<' + this.from + '>\r\n');
              }
            } else {
              socket.end();
              done({ ok: false, error: 'ehlo2 failed: ' + code });
            }
            break;

          case 'auth':
            if (code === '334') {
              state.name = 'user';
              socket.write(Buffer.from(this.user || '').toString('base64') + '\r\n');
            } else {
              socket.end();
              done({ ok: false, error: 'AUTH LOGIN failed: ' + code });
            }
            break;

          case 'user':
            if (code === '334') {
              state.name = 'pass';
              socket.write(Buffer.from(this.password || '').toString('base64') + '\r\n');
            } else {
              socket.end();
              done({ ok: false, error: 'username rejected: ' + code });
            }
            break;

          case 'pass':
            if (code.startsWith('2')) {
              state.name = 'mailfrom';
              socket.write('MAIL FROM:<' + this.from + '>\r\n');
            } else {
              socket.end();
              done({ ok: false, error: 'auth failed: ' + code });
            }
            break;

          case 'mailfrom':
            if (code.startsWith('2')) {
              state.name = 'rcpt';
              state.rcptIndex = 0;
              socket.write('RCPT TO:<' + state.toList[0] + '>\r\n');
            } else {
              socket.end();
              done({ ok: false, error: 'MAIL FROM rejected: ' + code });
            }
            break;

          case 'rcpt':
            if (code.startsWith('2')) {
              state.rcptIndex++;
              if (state.rcptIndex < state.toList.length) {
                socket.write('RCPT TO:<' + state.toList[state.rcptIndex] + '>\r\n');
              } else {
                state.name = 'data';
                socket.write('DATA\r\n');
              }
            } else {
              socket.end();
              done({ ok: false, error: 'RCPT TO rejected: ' + code });
            }
            break;

          case 'data':
            if (code === '354') {
              state.name = 'body';
              socket.write(message);
            } else {
              socket.end();
              done({ ok: false, error: 'DATA rejected: ' + code });
            }
            break;

          case 'body':
            if (code.startsWith('2')) {
              state.name = 'quit';
              socket.write('QUIT\r\n');
            } else {
              socket.end();
              done({ ok: false, error: 'message rejected: ' + code });
            }
            break;

          case 'quit':
            socket.end();
            done({ ok: true });
            break;

          default:
            socket.end();
            done({ ok: false, error: 'unexpected state: ' + state.name });
        }
      };

      this._attachHandlers(socket, respondTo, done);

      socket.on('error', (err) => done({ ok: false, error: err.message }));
      socket.on('timeout', () => {
        socket.destroy();
        done({ ok: false, error: 'timeout' });
      });
      socket.on('close', () => {
        // Если соединение закрылось до завершения диалога
        if (!settled) done({ ok: false, error: 'connection closed' });
      });
    });
  }

  _attachHandlers(socket, respondTo, done) {
    let buffer = '';
    socket.on('data', (data) => {
      buffer += data.toString();
      // SMTP-ответ может быть многострочным: "250-..." продолжения, "250 ..." последняя
      const lines = buffer.split('\r\n');
      // Оставляем последний неполный кусок в buffer
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line) continue;
        // Финальная строка ответа — 4-й символ пробел (не дефис)
        if (line.length >= 4 && line[3] === ' ') {
          respondTo(line.substring(0, 3));
        }
      }
    });
  }

  _buildMessage({ from, to, subject, text, html, attachments }) {
    const boundary = '----crucix-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    const lines = [];
    lines.push('From: ' + from);
    lines.push('To: ' + to.join(', '));
    lines.push('Subject: ' + subject);
    lines.push('MIME-Version: 1.0');
    lines.push('Date: ' + new Date().toUTCString());

    if (html || attachments.length > 0) {
      lines.push('Content-Type: multipart/mixed; boundary="' + boundary + '"');
      lines.push('');
      lines.push('--' + boundary);

      if (html) {
        lines.push('Content-Type: multipart/alternative; boundary="' + boundary + '-alt"');
        lines.push('');
        lines.push('--' + boundary + '-alt');
        lines.push('Content-Type: text/plain; charset=UTF-8');
        lines.push('');
        lines.push(text || '');
        lines.push('');
        lines.push('--' + boundary + '-alt');
        lines.push('Content-Type: text/html; charset=UTF-8');
        lines.push('');
        lines.push(html);
        lines.push('');
        lines.push('--' + boundary + '-alt--');
      } else {
        lines.push('Content-Type: text/plain; charset=UTF-8');
        lines.push('');
        lines.push(text || '');
      }

      for (const att of attachments) {
        lines.push('');
        lines.push('--' + boundary);
        lines.push('Content-Type: ' + (att.contentType || 'application/octet-stream'));
        lines.push('Content-Transfer-Encoding: base64');
        lines.push('Content-Disposition: attachment; filename="' + att.filename + '"');
        lines.push('');
        lines.push(att.content);
      }
      lines.push('');
      lines.push('--' + boundary + '--');
    } else {
      lines.push('Content-Type: text/plain; charset=UTF-8');
      lines.push('');
      lines.push(text || '');
    }

    // SMTP требует завершения тела точкой на отдельной строке
    lines.push('');
    lines.push('.');
    // Конец сообщения — CRLF после точки
    return lines.join('\r\n') + '\r\n';
  }
}

// --- HTML-ШАБЛОН ПИСЬМА ----------------------------

/** Экранирование HTML-спецсимволов для защиты от XSS через данные. */
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * HTML-письмо с композитным риском, топ-драйверами и ссылкой на дашборд.
 * Все данные экранируются.
 */
function buildPredictionEmail(result) {
  const cr = (result && result.compositeRisk) || {};
  const color = ({
    low: '#06b6d4',
    moderate: '#22c55e',
    elevated: '#eab308',
    high: '#f97316',
    critical: '#ef4444',
  })[cr.level] || '#3b82f6';

  const driversHtml = (cr.topDrivers || []).slice(0, 5).map(d => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(d.name)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-family: monospace;">
        ${(Number(d.value) * 100).toFixed(1)}%
      </td>
    </tr>
  `).join('');

  const dashboardUrl = (process.env.CRUCIX_DASHBOARD_URL || 'http://localhost') + '/crucix.html';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, sans-serif; background: #f5f5f5; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: ${color}; color: white; padding: 24px;">
      <h1 style="margin: 0; font-size: 24px;">Crucix Alert: ${escapeHtml((cr.level || '').toUpperCase())}</h1>
      <p style="margin: 8px 0 0; opacity: 0.9;">Composite Risk: ${(Number(cr.composite) || 0).toFixed(3)}</p>
    </div>
    <div style="padding: 24px;">
      <p><strong>Confidence:</strong> ${escapeHtml(cr.confidence || 'unknown')}</p>
      <p><strong>Signals:</strong> ${(cr.signals || []).length}</p>

      <h3>Top Drivers</h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${driversHtml}
      </table>

      <p style="margin-top: 24px;">
        <a href="${escapeHtml(dashboardUrl)}"
           style="display: inline-block; background: ${color}; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 6px;">
          Open Dashboard
        </a>
      </p>
    </div>
    <div style="padding: 16px 24px; background: #fafafa; font-size: 12px; color: #666;">
      Generated by Crucix Integrations ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>
  `;
}

// --- ПУБЛИЧНЫЙ API ---------------------------------

export async function sendEmailAlert(result, config) {
  const client = new SMTPClient(config);

  if (!client.enabled || !config.to) {
    return { skipped: true, reason: 'not_configured' };
  }

  const cr = result.compositeRisk;
  if (!cr || (cr.level !== 'high' && cr.level !== 'critical')) {
    return { skipped: true, reason: 'low_priority' };
  }

  const subject = `Crucix ${cr.level.toUpperCase()}: ${cr.composite.toFixed(3)}`;
  const text = `Crucix Alert\nComposite Risk: ${cr.composite.toFixed(3)}\nLevel: ${cr.level}\n`;
  const html = buildPredictionEmail(result);

  return await client.send({
    to: config.to,
    subject,
    text,
    html,
  });
}

export const EMAIL_INFO = {
  name: 'Email (SMTP)',
  description: 'Send alerts via SMTP (pure JS, no nodemailer)',
  envVars: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'],
  optional: true,
};

export { SMTPClient, buildPredictionEmail };
