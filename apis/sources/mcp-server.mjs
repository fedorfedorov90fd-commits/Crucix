// Crucix — MCPServer (Model Context Protocol)
// Реализация MCP для доступа к Crucix из внешних клиентов.

export default class MCPServer {
  constructor(opts = {}) {
    this.tools = new Map();
    this.resources = new Map();
    this.sessions = new Map();
  }

  registerTool(name, description, inputSchema, handler) {
    this.tools.set(name, { name, description, inputSchema, handler, registered: Date.now() });
    return this;
  }

  registerResource(uri, description, handler) {
    this.resources.set(uri, { uri, description, handler, registered: Date.now() });
    return this;
  }

  async callTool(name, args) {
    const tool = this.tools.get(name);
    if (!tool) return { error: `Unknown tool: ${name}` };
    try {
      const result = await tool.handler(args || {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { error: e.message };
    }
  }

  async readResource(uri) {
    const res = this.resources.get(uri);
    if (!res) return { error: `Unknown resource: ${uri}` };
    try {
      const result = await res.handler();
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { error: e.message };
    }
  }

  listTools() {
    return [...this.tools.values()].map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
  }

  listResources() {
    return [...this.resources.values()].map(r => ({ uri: r.uri, description: r.description }));
  }

  stats() {
    return { tools: this.tools.size, resources: this.resources.size, sessions: this.sessions.size };
  }
}
