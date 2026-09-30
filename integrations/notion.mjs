// integrations/notion.mjs
// Notion API клиент — сохранение прогнозов в базы данных
//
// Возможности:
//   - Создание записи в database
//   - Обновление существующих страниц
//   - Создание страниц со structured content
//   - Запросы по фильтрам

const NOTION_API_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export class NotionClient {
  constructor({ apiToken, databaseId } = {}) {
    this.apiToken = apiToken || process.env.NOTION_API_TOKEN;
    this.databaseId = databaseId || process.env.NOTION_DATABASE_ID;
    this.enabled = !!this.apiToken;
  }

  async _request(path, method = 'GET', body = null) {
    if (!this.apiToken) {
      return { ok: false, error: 'api_token_missing' };
    }

    try {
      const res = await fetch(`${NOTION_API_URL}${path}`, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.message || 'api_error', status: res.status };
      }
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async createPage(properties, { children = [], icon = null } = {}) {
    const body = {
      parent: { database_id: this.databaseId },
      properties,
    };
    if (children.length > 0) body.children = children;
    if (icon) body.icon = { emoji: icon };

    return await this._request('/pages', 'POST', body);
  }

  async updatePage(pageId, properties) {
    return await this._request(`/pages/${pageId}`, 'PATCH', { properties });
  }

  async query(filter = null, { sorts = [], pageSize = 100 } = {}) {
    const body = { page_size: pageSize };
    if (filter) body.filter = filter;
    if (sorts.length > 0) body.sorts = sorts;

    return await this._request(`/databases/${this.databaseId}/query`, 'POST', body);
  }

  async savePrediction(result) {
    const cr = result.compositeRisk;
    if (!cr) return { ok: false, error: 'no_composite' };

    const properties = {
      'Name': {
        title: [{
          text: { content: `Prediction ${new Date(result.timestamp).toLocaleString()}` },
        }],
      },
      'Timestamp': {
        date: { start: result.timestamp },
      },
      'Composite Risk': {
        number: cr.composite,
      },
      'Level': {
        select: { name: cr.level },
      },
      'Confidence': {
        select: { name: cr.confidence || 'unknown' },
      },
      'Signals Count': {
        number: cr.signals?.length || 0,
      },
    };

    const children = [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Top Drivers' } }],
        },
      },
    ];

    for (const driver of (cr.topDrivers || []).slice(0, 5)) {
      children.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{
            type: 'text',
            text: { content: `${driver.name}: ${(driver.value * 100).toFixed(1)}%` },
          }],
        },
      });
    }

    children.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'All Signals' } }],
      },
    });

    for (const sig of (cr.signals || []).slice(0, 20)) {
      children.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            type: 'text',
            text: { content: `${sig.name}: ${(sig.value * 100).toFixed(1)}% × ${sig.weight.toFixed(2)}` },
          }],
        },
      });
    }

    return await this.createPage(properties, {
      children,
      icon: cr.level === 'critical' ? '🔴'
        : cr.level === 'high' ? '🟠'
        : cr.level === 'elevated' ? '🟡'
        : '🟢',
    });
  }
}

export async function savePredictionToNotion(result, config) {
  const client = new NotionClient(config);

  if (!client.enabled) {
    return { skipped: true, reason: 'not_configured' };
  }

  const cr = result.compositeRisk;
  if (!cr || cr.level === 'low') {
    return { skipped: true, reason: 'low_priority' };
  }

  return await client.savePrediction(result);
}

export const NOTION_INFO = {
  name: 'Notion',
  description: 'Save predictions to Notion databases',
  envVars: ['NOTION_API_TOKEN', 'NOTION_DATABASE_ID'],
  optional: true,
};
