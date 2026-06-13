# lemura-cli

A simple but beautiful terminal AI agent, built on [lemura](https://www.npmjs.com/package/lemura) `v1.6.0`.

```
   __
  / /  ___ _ __ ___  _   _ _ __ __ _
 / /  / _ \ '_ ` _ \| | | | '__/ _` |
/ /__|  __/ | | | | | |_| | | | (_| |
\____/\___|_| |_| |_|\__,_|_|  \__,_|
```

A thinking spinner, a gradient banner, slash commands, two built-in tools
(time + calculator), and **MCP support** — connect any Model Context Protocol
server and its tools become available to the agent through lemura's ReAct loop.

## Setup

```bash
npm install
cp .env.example .env   # then add your API key
```

Works with OpenAI, Groq, Together, Ollama, or any OpenAI-compatible endpoint —
just point `LEMURA_BASE_URL` / `LEMURA_MODEL` at your provider.

## Usage

Interactive chat:

```bash
npm start
# or, once installed globally / linked:
lemura-cli
```

One-shot question:

```bash
lemura-cli "what's (12 * 8) + 5, and what time is it in Tokyo?"
```

Verbose logging (lemura debug traces):

```bash
lemura-cli --verbose
```

### Commands

| Command   | Action                       |
|-----------|------------------------------|
| `/help`   | show help                    |
| `/clear`  | clear the screen             |
| `/model`  | show the active model        |
| `/mcp`    | list connected MCP servers   |
| `/tools`  | list all available tools     |
| `/exit`   | quit (or Ctrl+C)             |

## MCP servers

Drop a `mcp.json` in the project root (copy `mcp.example.json`) and the agent
connects to each server on startup, registering its tools alongside the built-in
ones. Both stdio and HTTP/SSE transports are supported.

```bash
cp mcp.example.json mcp.json
```

```json
{
  "servers": [
    {
      "name": "everything",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"]
    },
    {
      "name": "remote-tools",
      "transport": "http",
      "url": "http://localhost:3001",
      "headers": { "Authorization": "Bearer ${MCP_REMOTE_TOKEN}" }
    }
  ]
}
```

- Secrets use `${VAR}` expansion against your environment — keep tokens in `.env`, not in `mcp.json`.
- Configured MCP servers are treated as **trusted**: their tools are auto-accepted by the tool firewall. Built-in tools are always whitelisted; with no MCP servers the firewall denies anything unexpected by default.
- `mcp.json` is gitignored (it may contain endpoints/secrets).

### Remote HTTPS MCP server

For a hosted MCP server, use the `http` transport with an `https://` URL. Put the
bearer token (or any auth header) in `.env` and reference it with `${VAR}` so the
secret never lands in `mcp.json`:

```jsonc
// mcp.json
{
  "servers": [
    {
      "name": "remote-https",
      "transport": "http",
      "url": "https://mcp.example.com/v1",
      "headers": {
        "Authorization": "Bearer ${MCP_REMOTE_TOKEN}"
      },
      "timeoutMs": 30000
    }
  ]
}
```

```ini
# .env
MCP_REMOTE_TOKEN=sk-your-remote-mcp-token
```

Notes:
- `https://` works exactly like `http://` — TLS is handled by the URL scheme; no extra config.
- Use `"transport": "sse"` instead if the server speaks Server-Sent Events rather than streamable HTTP.
- `timeoutMs` is the per-call timeout (default `30000`); raise it for slow remote tools.
- Add as many `headers` as the server needs (e.g. `"X-Api-Key": "${MCP_API_KEY}"`).

## How it works

- [src/agent.js](src/agent.js) — wires a lemura `SessionManager` with an
  `OpenAICompatibleAdapter`, system prompt, tools, MCP servers, firewall, and logger.
- [src/tools.js](src/tools.js) — `IToolDefinition` tools (current time, safe calculator).
- [src/mcp.js](src/mcp.js) — loads `mcp.json` and expands `${VAR}` secrets.
- [bin/cli.js](bin/cli.js) — the interactive REPL; runs the agent via `session.run()`,
  awaits MCP connection, and disconnects on exit.
- [src/ui.js](src/ui.js) — zero-dependency ANSI styling, banner, and spinner.

## License

MIT
