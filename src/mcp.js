import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export class McpLoader {
  constructor(configPath = resolve(process.cwd(), 'mcp.json')) {
    this.configPath = configPath;
  }

  load() {
    if (!existsSync(this.configPath)) return [];

    let raw;
    try {
      raw = JSON.parse(readFileSync(this.configPath, 'utf8'));
    } catch (err) {
      throw new Error(`Failed to parse mcp.json: ${err.message}`);
    }

    const servers = Array.isArray(raw) ? raw : raw.servers;
    if (!Array.isArray(servers)) {
      throw new Error('mcp.json must contain a "servers" array (or be an array itself).');
    }

    return servers.map((s, i) => {
      if (!s.name) throw new Error(`mcp.json server[${i}] is missing "name".`);
      if (!s.transport) throw new Error(`mcp.json server "${s.name}" is missing "transport".`);
      return this.#expandEnv(s);
    });
  }

  // Expand `${VAR}` references in any string value against process.env.
  #expandEnv(value) {
    if (typeof value === 'string') {
      return value.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] ?? '');
    }
    if (Array.isArray(value)) return value.map((v) => this.#expandEnv(v));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.#expandEnv(v)]));
    }
    return value;
  }
}
