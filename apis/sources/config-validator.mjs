// Crucix — ConfigValidator
// Валидация конфигурационных файлов на схему.

export default class ConfigValidator {
  constructor() { this.schemas = new Map(); }
  defineSchema(name, schema) {
    // schema = { required: [...], types: { field: 'string'|'number'|'array'|'object' }, min: {...}, max: {...} }
    this.schemas.set(name, schema);
    return this;
  }
  validate(schemaName, data) {
    const schema = this.schemas.get(schemaName);
    if (!schema) return { valid: false, errors: ['Unknown schema: ' + schemaName] };
    const errors = [];
    for (const field of (schema.required || [])) {
      if (data[field] === undefined) errors.push(`Missing required: ${field}`);
    }
    for (const [field, type] of Object.entries(schema.types || {})) {
      if (data[field] === undefined) continue;
      const actual = Array.isArray(data[field]) ? 'array' : typeof data[field];
      if (actual !== type) errors.push(`Field ${field}: expected ${type}, got ${actual}`);
    }
    for (const [field, min] of Object.entries(schema.min || {})) {
      if (typeof data[field] === 'number' && data[field] < min) errors.push(`Field ${field}: ${data[field]} < ${min}`);
    }
    for (const [field, max] of Object.entries(schema.max || {})) {
      if (typeof data[field] === 'number' && data[field] > max) errors.push(`Field ${field}: ${data[field]} > ${max}`);
    }
    return { valid: errors.length === 0, errors, schema: schemaName };
  }
  listSchemas() { return [...this.schemas.keys()]; }
}
