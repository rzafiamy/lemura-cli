import { SessionManager, OpenAICompatibleAdapter, DefaultLogger, LogLevel } from 'lemura';
import { tools } from './tools.js';

const SYSTEM_PROMPT = `You are Lemura, a concise and friendly terminal assistant.
- Answer in clean Markdown-light plain text suited to a terminal.
- Be direct: lead with the answer, then a short explanation only if useful.
- Use the available tools (time, calculator) instead of guessing facts they cover.
- Keep responses tight; avoid filler and apologies.`;

/**
 * Build a configured lemura SessionManager.
 * Reads provider settings from the environment (see .env.example).
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

  const session = new SessionManager({
    adapter,
    model,
    maxTokens: 100000,
    maxIterations: 8,
    systemPrompt: SYSTEM_PROMPT,
    tools,
    logger,
    // lemura's firewall defaults to 'ask', which blocks tools when no handler
    // is wired. Our built-in tools (time, calculator) are safe and read-only,
    // so allow them explicitly while denying anything unexpected.
    toolFirewall: {
      defaultDecision: 'deny',
      rules: [
        {
          name: '^(get_current_time|calculate)$',
          decision: 'accept',
          reason: 'Built-in safe utility tool.',
        },
      ],
    },
  });

  return { session, model };
}
