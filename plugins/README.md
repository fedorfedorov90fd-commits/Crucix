# Crucix Plugins

Система расширений для Crucix. Плагины могут добавлять:

- **Signals** — новые сигналы в композитный индикатор
- **Notifiers** — новые способы уведомлений
- **Fetchers** — источники данных
- **Analyzers** — пост-обработка прогнозов
- **Full** — комбинация всего

## Структура проекта
plugins/
├── loader.mjs — загрузка плагинов, регистрация hooks
├── manifest_schema.mjs — валидация manifest.json
├── sandbox.mjs — изолированное исполнение (worker_threads)
├── sandbox_worker.mjs — worker для sandbox
├── registry.mjs — локальный реестр + featured плагины
├── hooks.mjs — lifecycle hooks с приоритетами и timeout
├── installed/ — установленные плагины (создаётся автоматически)
└── examples/ — примеры
├── hello-world/ — минимальный плагин
├── custom-signal/ — добавление сигнала
└── data-fetcher/ — периодический fetcher

text

## Быстрый старт

### 1. Создать директорию плагина

```bash
mkdir -p plugins/installed/my-plugin
cd plugins/installed/my-plugin
2. Создать manifest.json
json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "author": "Your Name",
  "license": "MIT",
  "entryPoint": "index.mjs",
  "crucixVersion": ">=3.0.0",
  "type": "analyzer",
  "hooks": ["afterPrediction"],
  "permissions": ["read:predictions"]
}
3. Создать index.mjs
javascript
 Run JS
export async function init(config) {
  console.log('Plugin initialized with', config);
}

export async function afterPrediction(result) {
  const cr = result.compositeRisk;
  console.log('Composite Risk:', cr.composite, 'Level:', cr.level);
}

export async function onShutdown() {
  console.log('Plugin shutting down');
}
4. Загрузить плагин
javascript
 Run JS
import { getPluginLoader } from './plugins/loader.mjs';

const loader = getPluginLoader();
const results = await loader.loadAll();
console.log(results);

// Запустить хук
const hookResults = await loader.runHook('afterPrediction', predictionResult);
Manifest Schema
Обязательные поля
name	string	Lowercase, hyphens (например my-plugin)
version	string	Semver (например 1.0.0)
entryPoint	string	Путь к файлу входа (например index.mjs)
type	string	signal, notifier, fetcher, analyzer, full
Опциональные поля
description	string	''	Краткое описание
author	string	''	Автор
license	string	MIT	Лицензия
homepage	string	''	Сайт проекта
repository	string	''	Git-репозиторий
keywords	string[]	[]	Ключевые слова для поиска
tags	string[]	[]	Теги
icon	string	''	Иконка
crucixVersion	string	>=3.0.0	Semver range: >=, >, <, ^, ~, ||, A - B
hooks	string[]	[]	Lifecycle hooks
permissions	string[]	[]	Требуемые разрешения
config.schema	object	{}	JSON Schema для config
config.defaults	object	{}	Значения по умолчанию
dependencies	object	{}	Зависимости: { name: "range" }
optionalDependencies	object	{}	Опциональные зависимости
Получить схему программно:

javascript
 Run JS
import { getSchema } from './plugins/manifest_schema.mjs';
const schema = getSchema();
// { required: [...], optional: [...], validTypes: [...], ... }
Lifecycle Hooks
onStartup	lifecycle	При старте Crucix	—
onShutdown	lifecycle	При завершении	—
beforePrediction	prediction	Перед prediction cycle	latest
afterPrediction	prediction	После prediction cycle	result
onSignal	signal	Для каждого сигнала	signal, value
onSignalHigh	signal	Сигнал превысил порог	signal
onAlert	alert	Алерт сработал	alert
onRegimeChange	alert	Смена режима	changeData
onTimer	timer	Периодически	elapsedMs
Приоритеты handler'ов: чем выше priority, тем раньше вызывается. Timeout на handler — 5 секунд по умолчанию.

javascript
 Run JS
import { getHookManager } from './plugins/hooks.mjs';

const hooks = getHookManager({ handlerTimeoutMs: 5000, parallel: false });
hooks.on('afterPrediction', handler, { pluginName: 'my-plugin', priority: 10 });
hooks.scheduleTimer('onTimer', 60000);
const results = await hooks.emit('afterPrediction', predictionResult);
Permissions
Плагин объявляет разрешения в манифесте. По умолчанию — никаких разрешений.

read:memory	Чтение runs/memory
write:memory	Запись в runs/memory
read:predictions	Чтение прогнозов
write:predictions	Запись прогнозов
read:config	Чтение конфига
write:config	Изменение конфига
network:outbound	HTTP-запросы
network:inbound	HTTP-сервер
filesystem:read	Чтение файлов
filesystem:write	Запись файлов	да
system:exec	Выполнение команд	да
При валидации манифеста filesystem:write и system:exec дают warning — «sensitive permission requested».

Sandboxing
Плагины выполняются в изолированных worker_threads с ограничениями:

Memory limit — 128 MB по умолчанию (maxOldGenerationSizeMb)

Timeout — 30 секунд на вызов функции

Init timeout — 10 секунд

Shutdown timeout — 5 секунд

Permission checks — перехват fetch (проверка network:outbound)

Empty environment — переменные окружения недоступны (env: {})

Защита от prototype pollution — __proto__, constructor, prototype запрещены как имена функций

javascript
 Run JS
import { SandboxManager } from './plugins/sandbox.mjs';

const manager = new SandboxManager({ maxSandboxes: 10 });
const sandbox = await manager.createSandbox(manifest, entryPath, config);
const result = await sandbox.call('myFunction', arg1, arg2);
await manager.destroySandbox(manifest.name);
Registry
Локальный реестр: plugins/registry.json (атомарная запись).

javascript
 Run JS
import { getPluginRegistry } from './plugins/registry.mjs';

const registry = getPluginRegistry();
registry.register(manifest);
registry.list();
registry.findByHook('afterPrediction');
registry.findByType('signal');
registry.findByPermission('network:outbound');
registry.resolveDependencies(manifest);   // поддерживает >=, ^, ~, ||
registry.checkDependencyGraph();          // топологический порядок + циклы
registry.stats();
Примеры
hello-world
Минимальный плагин, логирует прогнозы.

bash
cp -r plugins/examples/hello-world plugins/installed/
custom-signal
Добавляет кастомный сигнал в composite risk.

bash
cp -r plugins/examples/custom-signal plugins/installed/
data-fetcher
Периодически фетчит данные из API.

bash
cp -r plugins/examples/data-fetcher plugins/installed/
Разработка
Локальное тестирование
javascript
 Run JS
import { PluginLoader } from './plugins/loader.mjs';

const loader = new PluginLoader({ pluginsDir: './my-test-plugins' });
const result = await loader.loadAll();
console.log(result);

// Ошибки при обнаружении/загрузке
console.log(loader.getErrors());
console.log(loader.stats());
Sandbox testing
javascript
 Run JS
import { SandboxManager } from './plugins/sandbox.mjs';

const manager = new SandboxManager();
const sandbox = await manager.createSandbox(manifest, entryPath, config);
const result = await sandbox.call('myFunction', arg1, arg2);
await manager.destroyAll();
Публикация плагина
Опубликовать на GitHub с тегом crucix-plugin

Добавить в Community Plugins

Опционально — в официальный реестр (FEATURED_PLUGINS в registry.mjs)

Безопасность
Всегда проверяйте код плагина перед установкой

Запрашивайте минимальные разрешения

Используйте sandbox для недоверенных плагинов

Проверяйте manifest — валидация автоматическая

Сенситивные permissions (filesystem:write, system:exec) дают предупреждение

Worker не имеет доступа к env, файловой системе и сети без явного permission

Zero-dependency
Все модули и примеры плагинов работают на чистом Node.js (>= 20). Никаких npm-пакетов.

Единственное, что нужно — правильно структурировать код и указать permissions в манифесте.

Частые вопросы
Плагин не загружается, что делать?

Проверьте loader.getErrors() — там список всех проблем (manifest.json отсутствует, невалидный JSON, версия несовместима и т.д.).

Как отладить sandbox?

Временно запустите плагин вне sandbox через PluginLoader — но только для доверенного кода.

Можно ли переопределить существующий плагин?

loader.load() возвращает { ok: false, error: 'already_loaded' }. Явно вызовите loader.unload(name), затем loader.load(...) заново, или используйте loader.reload(name).

Где хранится реестр?

plugins/registry.json. Пишется атомарно — при сбое питания файл не побьётся.

Как обновить плагин?

register() сохранит installedAt первой установки и обновит updatedAt. reload(name) перезагрузит код без перезапуска Crucix.
