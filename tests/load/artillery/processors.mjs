// tests/load/artillery/processors.mjs
// Artillery custom processors

export function onConnect(context, events, done) {
  context.vars.connectTime = Date.now();
  events.emit('counter', 'ws.connections', 1);
  return done();
}

export function closeConnection(context, events, done) {
  const duration = Date.now() - (context.vars.connectTime || Date.now());
  events.emit('histogram', 'ws.connection_duration_ms', duration);
  return done();
}

export function validateMessage(context, events, done) {
  const message = context.vars.message;

  if (!message) return done();

  try {
    const parsed = JSON.parse(message);
    if (parsed.type === 'pong') {
      const latency = Date.now() - parsed.timestamp;
      events.emit('histogram', 'ws.pong_latency_ms', latency);
    }
    context.vars.lastMessage = parsed;
  } catch (e) {
    events.emit('counter', 'ws.parse_errors', 1);
  }

  return done();
}
