# lemura-cli

A simple but beautiful terminal AI agent, built on [lemura](https://www.npmjs.com/package/lemura) `v1.6.0`.

```
   __
  / /  ___ _ __ ___  _   _ _ __ __ _
 / /  / _ \ '_ ` _ \| | | | '__/ _` |
/ /__|  __/ | | | | | |_| | | | (_| |
\____/\___|_| |_| |_|\__,_|_|  \__,_|
```

Streaming responses, a thinking spinner, a gradient banner, slash commands, and two
built-in tools (time + calculator) that the agent calls through lemura's ReAct loop.

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

| Command  | Action                |
|----------|-----------------------|
| `/help`  | show help             |
| `/clear` | clear the screen      |
| `/model` | show the active model |
| `/exit`  | quit (or Ctrl+C)      |

## How it works

- [src/agent.js](src/agent.js) — wires a lemura `SessionManager` with an
  `OpenAICompatibleAdapter`, system prompt, tools, and logger.
- [src/tools.js](src/tools.js) — `IToolDefinition` tools (current time, safe calculator).
- [bin/cli.js](bin/cli.js) — the interactive REPL using `session.stream()` for
  token-by-token output.
- [src/ui.js](src/ui.js) — zero-dependency ANSI styling, banner, and spinner.

## License

MIT
