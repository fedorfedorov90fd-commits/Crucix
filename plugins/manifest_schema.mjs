// plugins/manifest_schema.mjs
// Схема и валидация manifest.json для плагинов Crucix.
//
// Ожидаемая схема манифеста:
// {
//   "name": "my-plugin",
//   "version": "1.0.0",
//   "description": "What this plugin does",
//   "author": "Your Name <you@example.com>",
//   "license": "MIT",
//   "entryPoint": "index.mjs",
//   "crucixVersion": ">=3.0.0",
//   "type": "signal" | "notifier" | "fetcher" | "analyzer" | "full",
//   "hooks": ["afterPrediction", "onSignal"],
//   "permissions": ["read:memory", "write:predictions"],
//   "config": { "schema": { ... }, "defaults": { ... } },
//   "dependencies": {},
//   "optionalDependencies": {}
// }
//
// Особенности:
//   - Zero dependencies: только стандартные средства Node.js.
//   - Поддержка диапазонов версий: >=, >, <, ^, ~, ||.
//   - Валидация config по подмножеству JSON Schema (properties, required,
//     enum, minimum, maximum, minLength, maxLength, pattern, items,
//     oneOf, anyOf, const, default).

const VALID_TYPES = ['signal', 'notifier', 'fetcher', 'analyzer', 'full'];

const VALID_HOOKS = [
  'beforePrediction',
  'afterPrediction',
  'onSignal',
  'onAlert',
  'onRegimeChange',
  'onStartup',
  'onShutdown',
  'onTimer',
];

const VALID_PERMISSIONS = [
  'read:memory',
  'write:memory',
  'read:predictions',
  'write:predictions',
  'read:config',
  'write:config',
  'network:outbound',
  'network:inbound',
  'filesystem:read',
  'filesystem:write',
  'system:exec',
];

const SENSITIVE_PERMISSIONS = ['filesystem:write', 'system:exec'];

const HOOK_CATEGORIES = {
  lifecycle: ['onStartup', 'onShutdown'],
  prediction: ['beforePrediction', 'afterPrediction'],
  signal: ['onSignal', 'onAlert'],
  alert: ['onRegimeChange'],
  timer: ['onTimer'],
};

function _isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function validateManifest(manifest) {
  const errors = [];
  const warnings = [];

  if (!_isPlainObject(manifest)) {
    return {
      valid: false,
      errors: ['manifest must be a plain object'],
      warnings: [],
      manifest: null,
    };
  }

  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('name is required (string)');
  } else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(manifest.name)) {
    errors.push('name must be lowercase alphanumeric with hyphens (e.g., "my-plugin")');
  }

  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('version is required (semver string)');
  } else if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
    errors.push('version must be semver (e.g., "1.0.0")');
  }

  if (!manifest.entryPoint || typeof manifest.entryPoint !== 'string') {
    errors.push('entryPoint is required (e.g., "index.mjs")');
  }

  if (!manifest.crucixVersion || typeof manifest.crucixVersion !== 'string') {
    warnings.push('crucixVersion not specified — assuming any version');
  }

  if (!manifest.type) {
    errors.push('type is required');
  } else if (!VALID_TYPES.includes(manifest.type)) {
    errors.push('type must be one of: ' + VALID_TYPES.join(', '));
  }

  if (manifest.hooks) {
    if (!Array.isArray(manifest.hooks)) {
      errors.push('hooks must be an array');
    } else {
      for (const hook of manifest.hooks) {
        if (!VALID_HOOKS.includes(hook)) {
          errors.push('invalid hook: ' + hook + ' (valid: ' + VALID_HOOKS.join(', ') + ')');
        }
      }
    }
  }

  if (manifest.permissions) {
    if (!Array.isArray(manifest.permissions)) {
      errors.push('permissions must be an array');
    } else {
      for (const perm of manifest.permissions) {
        if (!VALID_PERMISSIONS.includes(perm)) {
          errors.push('invalid permission: ' + perm + ' (valid: ' + VALID_PERMISSIONS.join(', ') + ')');
        } else if (SENSITIVE_PERMISSIONS.includes(perm)) {
          warnings.push('sensitive permission requested: ' + perm);
        }
      }

      if (manifest.type === 'full' && manifest.permissions.length === 0) {
        warnings.push('type "full" declared but no permissions requested');
      }
    }
  }

  if (manifest.dependencies !== undefined) {
    if (!_isPlainObject(manifest.dependencies)) {
      errors.push('dependencies must be an object');
    }
  }

  if (manifest.optionalDependencies !== undefined) {
    if (!_isPlainObject(manifest.optionalDependencies)) {
      errors.push('optionalDependencies must be an object');
    }
  }

  if (manifest.config !== undefined) {
    if (!_isPlainObject(manifest.config)) {
      errors.push('config must be an object');
    } else if (manifest.config.schema !== undefined && !_isPlainObject(manifest.config.schema)) {
      errors.push('config.schema must be a valid JSON Schema object');
    }
  }

  if (!manifest.description) warnings.push('description not provided');
  if (!manifest.author) warnings.push('author not provided');
  if (!manifest.license) warnings.push('license not provided');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    manifest: errors.length === 0 ? normalizeManifest(manifest) : null,
  };
}

function normalizeManifest(manifest) {
  return {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description || '',
    author: manifest.author || '',
    license: manifest.license || 'MIT',
    homepage: manifest.homepage || '',
    repository: manifest.repository || '',
    keywords: Array.isArray(manifest.keywords) ? manifest.keywords.slice() : [],
    tags: Array.isArray(manifest.tags) ? manifest.tags.slice() : [],
    icon: manifest.icon || '',
    entryPoint: manifest.entryPoint,
    crucixVersion: manifest.crucixVersion || '>=3.0.0',
    type: manifest.type,
    hooks: Array.isArray(manifest.hooks) ? manifest.hooks.slice() : [],
    permissions: Array.isArray(manifest.permissions) ? manifest.permissions.slice() : [],
    dependencies: _isPlainObject(manifest.dependencies) ? { ...manifest.dependencies } : {},
    optionalDependencies: _isPlainObject(manifest.optionalDependencies) ? { ...manifest.optionalDependencies } : {},
    config: _isPlainObject(manifest.config) ? { ...manifest.config } : { schema: {}, defaults: {} },
  };
}

function _parseVersion(v) {
  const m = String(v || '').match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function _compare(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return 1;
    if (a[i] < b[i]) return -1;
  }
  return 0;
}

function _satisfiesSingle(requirement, actual) {
  const req = requirement.trim();
  const a = _parseVersion(actual);

  if (req.startsWith('>=')) return _compare(a, _parseVersion(req.slice(2))) >= 0;
  if (req.startsWith('>')) return _compare(a, _parseVersion(req.slice(1))) > 0;
  if (req.startsWith('<=')) return _compare(a, _parseVersion(req.slice(2))) <= 0;
  if (req.startsWith('<')) return _compare(a, _parseVersion(req.slice(1))) < 0;

  if (req.startsWith('^')) {
    const r = _parseVersion(req.slice(1));
    if (a[0] !== r[0]) return false;
    return _compare(a, r) >= 0;
  }

  if (req.startsWith('~')) {
    const r = _parseVersion(req.slice(1));
    if (a[0] !== r[0] || a[1] !== r[1]) return false;
    return _compare(a, r) >= 0;
  }

  // Точное совпадение или диапазон вида "3.0.0 - 3.5.0"
  if (req.includes(' - ')) {
    const [low, high] = req.split(' - ').map(s => s.trim());
    return _compare(a, _parseVersion(low)) >= 0 && _compare(a, _parseVersion(high)) <= 0;
  }

  return _compare(a, _parseVersion(req)) === 0;
}

export function checkVersionCompatibility(requiredVersion, actualVersion = '3.0.0') {
  const req = String(requiredVersion || '>=0.0.0');
  const parts = req.split('||').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return true;
  return parts.some(part => _satisfiesSingle(part, actualVersion));
}

export function validateAgainstSchema(data, schema, _seen = new Set()) {
  const errors = [];

  if (!schema || typeof schema !== 'object' || Object.keys(schema).length === 0) return errors;

  // Защита от циклической рекурсии
  if (_seen.has(schema)) return errors;
  _seen.add(schema);

  // oneOf / anyOf
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter(sub => validateAgainstSchema(data, sub, new Set(_seen)).length === 0);
    if (matches.length !== 1) errors.push('value does not match exactly one of oneOf schemas');
    return errors;
  }

  if (Array.isArray(schema.anyOf)) {
    const matches = schema.anyOf.filter(sub => validateAgainstSchema(data, sub, new Set(_seen)).length === 0);
    if (matches.length === 0) errors.push('value does not match any of anyOf schemas');
    return errors;
  }

  // const
  if (schema.const !== undefined && data !== schema.const) {
    errors.push('value must equal const ' + JSON.stringify(schema.const));
  }

  // type
  if (schema.type) {
    const actualType = Array.isArray(data) ? 'array'
      : data === null ? 'null'
      : typeof data;

    if (schema.type !== actualType) {
      errors.push('expected type ' + schema.type + ', got ' + actualType);
      return errors;
    }
  }

  // required
  if (schema.required && Array.isArray(schema.required) && _isPlainObject(data)) {
    for (const key of schema.required) {
      if (data[key] === undefined) errors.push('missing required property: ' + key);
    }
  }

  // properties
  if (schema.properties && _isPlainObject(data)) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (data[key] !== undefined) {
        const propErrors = validateAgainstSchema(data[key], propSchema, new Set(_seen));
        for (const err of propErrors) errors.push(key + ': ' + err);
      }
    }
  }

  // items (для массивов)
  if (schema.items && Array.isArray(data)) {
    data.forEach((item, i) => {
      const itemErrors = validateAgainstSchema(item, schema.items, new Set(_seen));
      for (const err of itemErrors) errors.push('[' + i + ']: ' + err);
    });
  }

  // Числовые проверки
  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push('value ' + data + ' < minimum ' + schema.minimum);
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push('value ' + data + ' > maximum ' + schema.maximum);
    }
  }

  // Строковые проверки
  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push('string length ' + data.length + ' < minLength ' + schema.minLength);
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push('string length ' + data.length + ' > maxLength ' + schema.maxLength);
    }
    if (schema.pattern) {
      try {
        if (!new RegExp(schema.pattern).test(data)) {
          errors.push('string does not match pattern ' + schema.pattern);
        }
      } catch (e) {
        errors.push('invalid pattern in schema: ' + e.message);
      }
    }
  }

  // enum
  if (Array.isArray(schema.enum) && !schema.enum.includes(data)) {
    errors.push('value ' + JSON.stringify(data) + ' not in enum [' + schema.enum.join(', ') + ']');
  }

  return errors;
}

export function getSchema() {
  return {
    required: ['name', 'version', 'entryPoint', 'type'],
    optional: [
      'description', 'author', 'license', 'homepage', 'repository',
      'keywords', 'tags', 'icon', 'crucixVersion', 'hooks',
      'permissions', 'dependencies', 'optionalDependencies', 'config',
    ],
    validTypes: VALID_TYPES.slice(),
    validHooks: VALID_HOOKS.slice(),
    validPermissions: VALID_PERMISSIONS.slice(),
    sensitivePermissions: SENSITIVE_PERMISSIONS.slice(),
  };
}

export const SCHEMA_INFO = {
  validTypes: VALID_TYPES,
  validHooks: VALID_HOOKS,
  validPermissions: VALID_PERMISSIONS,
  sensitivePermissions: SENSITIVE_PERMISSIONS,
  hookCategories: HOOK_CATEGORIES,
};
