// Crucix — Actions Registry (реестр типов действий)
// Определяет все возможные типы действий в системе, их параметры,
// валидаторы и обработчики. Единая точка входа для слоя действий.
//
// Версия: 1.0.0
//
// АКАДЕМИЧЕСКОЕ ОБОСНОВАНИЕ:
//   Дашборд показывает. Слой действий — исполняет. Без реестра типов
//   действий система не может отличить "отправить алерт" от "создать
//   отчёт" или "добавить в watchlist". Реестр — центральный контракт
//   между потребителем (кто вызывает действие) и исполнителем (кто
//   реализует). Позволяет добавлять новые типы действий без изменения
//   ядра — регистрация через register().
//
// ТРИ КАТЕГОРИИ ДЕЙСТВИЙ:
//   1. notification — отправка уведомлений (alert, digest, escalation).
//   2. document    — генерация документов (report, summary, dossier).
//   3. state       — изменение состояния (watchlist, tag, favorite).

export const ACTION_CATEGORIES = Object.freeze({
  NOTIFICATION: 'notification',
  DOCUMENT:     'document',
  STATE:        'state',
});

export const ACTION_STATUSES = Object.freeze({
  PENDING:   'pending',
  RUNNING:   'running',
  SUCCESS:   'success',
  FAILED:    'failed',
  CANCELLED: 'cancelled',
});

// Встроенные типы действий (регистрируются при загрузке).
// Формат:
//   id            — уникальный идентификатор
//   category      — notification | document | state
//   description   — краткое описание
//   argsSchema    — схема аргументов { field: 'type' }
//   requiredArgs  — обязательные аргументы
//   handler       — async function(args, context) → result
//   cache         — TTL (сек), 0 = не кэшировать
//   idempotent    — можно ли вызывать повторно
const ACTIONS = new Map();

export class ActionsRegistry {
  constructor() {
    this._actions = ACTIONS;
    this._handlers = new Map();
  }

  // Регистрация действия.
  register(def) {
    if (!def || !def.id) throw new Error('action.id required');
    if (!def.category || !Object.values(ACTION_CATEGORIES).includes(def.category)) {
      throw new Error(`action.category must be one of ${Object.values(ACTION_CATEGORIES).join(', ')}`);
    }
    if (typeof def.handler !== 'function') throw new Error('action.handler required');

    this._actions.set(def.id, {
      id: def.id,
      category: def.category,
      description: def.description || '',
      argsSchema: def.argsSchema || {},
      requiredArgs: def.requiredArgs || [],
      cache: def.cache ?? 0,
      idempotent: def.idempotent ?? false,
      handler: def.handler,
    });
    return true;
  }

  // Снятие с регистрации.
  unregister(id) {
    return this._actions.delete(id);
  }

  // Получить определение.
  get(id) {
    return this._actions.get(id) || null;
  }

  // Список всех действий.
  list(category = null) {
    const all = Array.from(this._actions.values());
    const filtered = category ? all.filter(a => a.category === category) : all;
    return filtered.map(a => ({
      id: a.id,
      category: a.category,
      description: a.description,
      argsSchema: a.argsSchema,
      requiredArgs: a.requiredArgs,
      cache: a.cache,
      idempotent: a.idempotent,
    }));
  }

  // Валидация аргументов по схеме.
  validateArgs(id, args) {
    const def = this._actions.get(id);
    if (!def) return { ok: false, error: 'action_not_found' };

    const missing = [];
    for (const req of def.requiredArgs) {
      if (args == null || args[req] == null) missing.push(req);
    }
    if (missing.length > 0) return { ok: false, error: 'missing_args', missing };

    // Типовая проверка (базовая).
    for (const [field, type] of Object.entries(def.argsSchema)) {
      if (args[field] == null) continue;
      const actual = Array.isArray(args[field]) ? 'array' : typeof args[field];
      if (type === 'number' && actual !== 'number') return { ok: false, error: 'bad_type', field, expected: type, actual };
      if (type === 'string' && actual !== 'string') return { ok: false, error: 'bad_type', field, expected: type, actual };
      if (type === 'boolean' && actual !== 'boolean') return { ok: false, error: 'bad_type', field, expected: type, actual };
      if (type === 'array' && actual !== 'array') return { ok: false, error: 'bad_type', field, expected: type, actual };
    }
    return { ok: true };
  }

  // Выполнение действия.
  async execute(id, args, context = {}) {
    const def = this._actions.get(id);
    if (!def) {
      return { ok: false, status: ACTION_STATUSES.FAILED, error: 'action_not_found' };
    }

    const validation = this.validateArgs(id, args);
    if (!validation.ok) {
      return { ok: false, status: ACTION_STATUSES.FAILED, error: validation.error, details: validation };
    }

    const startedAt = Date.now();
    try {
      const result = await def.handler(args, { ...context, actionId: id });
      return {
        ok: true,
        status: ACTION_STATUSES.SUCCESS,
        actionId: id,
        result,
        elapsedMs: Date.now() - startedAt,
      };
    } catch (e) {
      return {
        ok: false,
        status: ACTION_STATUSES.FAILED,
        actionId: id,
        error: e.message,
        elapsedMs: Date.now() - startedAt,
      };
    }
  }

  // Статистика.
  stats() {
    const all = Array.from(this._actions.values());
    const byCategory = {};
    for (const a of all) byCategory[a.category] = (byCategory[a.category] || 0) + 1;
    return {
      total: all.length,
      byCategory,
      categories: Object.values(ACTION_CATEGORIES),
    };
  }

  clear() {
    this._actions.clear();
  }
}

// Глобальный синглтон для всего проекта.
let _instance = null;
export function getActionsRegistry() {
  if (_instance == null) _instance = new ActionsRegistry();
  return _instance;
}
