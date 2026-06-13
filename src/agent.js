import { SessionManager, OpenAICompatibleAdapter, DefaultLogger, LogLevel } from 'lemura';
import { tools } from './tools.js';
import { loadMcpServers } from './mcp.js';

const SYSTEM_PROMPT = `You are Lemura, a concise and friendly terminal assistant.
- Answer in clean Markdown-light plain text suited to a terminal.
- Be direct: lead with the answer, then a short explanation only if useful.
- Use the available tools instead of guessing facts they can answer.
- Keep responses tight; avoid filler and apologies.`;

/**
 * Build a configured lemura SessionManager.
 * Reads provider settings from the environment (see .env.example) and MCP
 * servers from ./mcp.json (see mcp.example.json).
 */
export function createAgent({ verbose = false } = {}) {
  const apiKey = process.env.LEMURA_API_KEY || process.env.OPENAI_API_KEY || '';
  const baseUrl =
    process.env.LEMURA_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.LEMURA_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    throw new Error(
      'No API key found. Set LEMURA_API_KEY (or OPENAI_API_KEY) in your environment or .env file.'
    );
  }

  const adapter = new OpenAICompatibleAdapter({ baseUrl, apiKey, defaultModel: model });

  const logger = new DefaultLogger();
  logger.setLevel(verbose ? LogLevel.DEBUG : LogLevel.WARN);

  const mcpServers = loadMcpServers();
  const hasMcp = mcpServers.length > 0;

  // Firewall trust model:
  //   - built-in tools (time, calculator) are always whitelisted explicitly.
  //   - when MCP servers are configured they are considered trusted, so the
  //     default decision becomes 'accept' (MCP tool names aren't known until
  //     after async connection, and namespacing isn't applied by lemura).
  //   - with no MCP servers, the default stays 'deny' for a tight surface.
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

  const session = new SessionManager({
    adapter,
    model,
    maxTokens: 100000,
    maxIterations: 8,
    systemPrompt: SYSTEM_PROMPT,
    tools,
    logger,
    toolFirewall,
    ...(hasMcp ? { mcpServers } : {}),
  });

  return { session, model, mcpServers };
}
