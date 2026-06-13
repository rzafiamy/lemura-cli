import { SessionManager, OpenAICompatibleAdapter, DefaultLogger, LogLevel } from 'lemura';
import { Config } from './config.js';
import { McpLoader } from './mcp.js';
import { ToolRegistry } from './tools.js';
import { SkillLoader } from './skills.js';

export class Agent {
  #session;
  #model;
  #mcpServers;
  #dynamicNames = new Set();

  constructor({ verbose = false, onTrace } = {}) {
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
    const skills = skillLoader.loadSkills();

    // The agent sees a catalog of every skill's frontmatter and decides which to
    // pull in via the load_skill tool. Append it to the base system prompt.
    const catalog = skillLoader.buildCatalog(skills);
    const systemPrompt = catalog
      ? `${skillLoader.loadSystemPrompt()}\n\n${catalog}`
      : skillLoader.loadSystemPrompt();

    const tools = new ToolRegistry().getAll();

    // The decision layer: the agent calls this to pull a skill's full content into
    // context. Enabling is deferred via #session so it binds the live injector.
    const dynamicNames = new Set(
      skills.filter((s) => s.strategy === 'dynamic').map((s) => s.name)
    );
    this.#dynamicNames = dynamicNames;
    if (dynamicNames.size) {
      tools.push({
        name: 'load_skill',
        description:
          'Load a specialized skill by name to get its full instructions for the current turn. Call this when the user\'s request matches a skill listed in your system prompt.',
        category: 'utility',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The skill name, exactly as listed in the available skills catalog.',
              enum: [...dynamicNames],
            },
          },
          required: ['name'],
        },
        execute: async ({ name } = {}) => {
          if (!dynamicNames.has(name)) {
            return `No skill named "${name}". Available: ${[...dynamicNames].join(', ')}.`;
          }
          this.#session.skills.enableSkill(name);
          return `Skill "${name}" loaded. Follow its instructions for this response.`;
        },
      });
    }

    const hasMcp = this.#mcpServers.length > 0;

    // Built-in tools are always whitelisted; MCP servers are trusted when configured.
    const toolFirewall = {
      defaultDecision: hasMcp ? 'accept' : 'deny',
      rules: [
        {
          name: '^(get_current_time|calculate|load_skill)$',
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
      systemPrompt,
      tools,
      skills,
      logger,
      toolFirewall,
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
    // Per-turn persistence: skills the agent loaded last turn are reset so each
    // message starts from the catalog and re-loads only what it now needs.
    for (const name of this.#dynamicNames) {
      this.#session.skills.disableSkill(name);
    }
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
