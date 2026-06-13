import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const CONFIG_PATH = resolve(process.cwd(), 'mcp.json');

// Expand `${VAR}` references in any string value against process.env so that
// secrets (tokens, keys) live in the environment, not in mcp.json.
function expandEnv(value) {
  if (typeof value === 'string') {
    return value.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] ?? '');
  }
  if (Array.isArray(value)) return value.map(expandEnv);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expandEnv(v)]));
  }
  return value;
}

/**
 * Load MCP server configs from ./mcp.json.
 * Returns an array of lemura MCPServerConfig objects (empty if no file).
 *
 * Shape of mcp.json:
 * {
 *   "servers": [
 *     { "name": "fetch", "transport": "stdio", "command": "npx",
 *       "args": ["-y", "@modelcontextprotocol/server-fetch"] },
 *     { "name": "db", "transport": "http", "url": "http://localhost:3001",
 *       "headers": { "Authorization": "Bearer ${DB_TOKEN}" } }
 *   ]
 * }
 */
export function loadMcpServers() {
  if (!existsSync(CONFIG_PATH)) return [];

  let raw;
  try {
    raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
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
    return expandEnv(s);
  });
}
