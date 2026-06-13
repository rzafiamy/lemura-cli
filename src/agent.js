import { SessionManager, OpenAICompatibleAdapter, DefaultLogger, LogLevel } from 'lemura';
import { Config } from './config.js';
import { McpLoader } from './mcp.js';
import { ToolRegistry } from './tools.js';
import { SkillLoader } from './skills.js';

export class Agent {
  #session;
  #model;
  #mcpServers;

  constructor({ verbose = false, onTrace, onAsk } = {}) {
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

    const skillLoader = new SkillLoader();
    const systemPrompt = skillLoader.loadSystemPrompt();
    const skills = skillLoader.loadSkills();
    const tools = new ToolRegistry().getAll();
    const hasMcp = this.#mcpServers.length > 0;

    // Allow get_current_time and calculate without asking; default to ask for everything else
    const toolFirewall = {
      defaultDecision: 'ask',
      rules: [
        {
          name: '^(get_current_time|calculate)$',
          decision: 'accept',
          reason: 'Built-in safe utility tools.',
        },
      ],
      ...(onAsk ? { onAsk } : {}),
    };

    this.#session = new SessionManager({
      adapter,
      model: config.model,
      maxTokens: 100000,
      maxIterations: 8,
      systemPrompt,
      tools,
      skills,
      logger,
      toolFirewall,
      // Skills are progressive (strategy: 'progressive'): lemura injects the
      // catalog, registers load_skill, and resets per turn — no glue needed here.
      skillSelection: { persistence: 'per_turn' },
      ...(onTrace ? { onTrace } : {}),
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

  getAllSkills() {
    return this.#session.skills?.getAll?.() ?? [];
  }
}
