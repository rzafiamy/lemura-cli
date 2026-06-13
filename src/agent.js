import { SessionManager, OpenAICompatibleAdapter, DefaultLogger, LogLevel } from 'lemura';
import { Config } from './config.js';
import { McpLoader } from './mcp.js';
import { ToolRegistry } from './tools.js';

const SYSTEM_PROMPT = `You are Lemura, a concise and friendly terminal assistant.
- Answer in clean Markdown-light plain text suited to a terminal.
- Be direct: lead with the answer, then a short explanation only if useful.
- Use the available tools instead of guessing facts they can answer.
- Keep responses tight; avoid filler and apologies.`;

export class Agent {
  #session;
  #model;
  #mcpServers;

  constructor({ verbose = false } = {}) {
    const config = new Config().validate();
    this.#model = config.model;
    this.#mcpServers = new McpLoader().load();

    const adapter = new OpenAICompatibleAdapter({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      defaultModel: config.model,
    });

    const logger = new DefaultLogger();
    logger.setLevel(verbose ? LogLevel.DEBUG : LogLevel.WARN);

    const tools = new ToolRegistry().getAll();
    const hasMcp = this.#mcpServers.length > 0;

    // Built-in tools are always whitelisted; MCP servers are trusted when configured.
    const toolFirewall = {
      defaultDecision: hasMcp ? 'accept' : 'deny',
      rules: [
        {
          name: '^(get_current_time|calculate)$',
          decision: 'accept',
          reason: 'Built-in safe utility tool.',
        },
      ],
    };

    this.#session = new SessionManager({
      adapter,
      model: config.model,
      maxTokens: 100000,
      maxIterations: 8,
      systemPrompt: SYSTEM_PROMPT,
      tools,
      logger,
      toolFirewall,
      ...(hasMcp ? { mcpServers: this.#mcpServers } : {}),
    });
  }

  get model() {
    return this.#model;
  }

  get mcpServers() {
    return this.#mcpServers;
  }

  get session() {
    return this.#session;
  }

  async waitForMcp() {
    if (!this.#mcpServers.length) return;
    try {
      if (this.#session.mcpReady) await this.#session.mcpReady;
    } catch {
      /* per-server failures are logged by lemura; keep going */
    }
  }

  async ask(question) {
    return this.#session.run(question);
  }

  async close() {
    try {
      await this.#session.close();
    } catch {
      /* ignore disconnect errors on shutdown */
    }
  }

  getAllTools() {
    return this.#session.tools?.getAll?.() ?? [];
  }
}
