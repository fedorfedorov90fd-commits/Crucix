// Crucix — CLIAnalytics
// Команды для CLI-аналитики: запросы к анализаторам через терминал.

export default class CLIAnalytics {
  constructor() { this.commands = new Map(); }
  register(name, description, handler) {
    this.commands.set(name, { name, description, handler });
    return this;
  }
  async execute(name, args = []) {
    const cmd = this.commands.get(name);
    if (!cmd) return { error: `Unknown command: ${name}` };
    try {
      return await cmd.handler(args);
    } catch (e) {
      return { error: e.message };
    }
  }
  listCommands() {
    return [...this.commands.values()].map(c => ({ name: c.name, description: c.description }));
  }
}
