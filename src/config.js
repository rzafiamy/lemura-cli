export class Config {
  constructor(env = process.env) {
    this.apiKey = env.LEMURA_API_KEY || env.OPENAI_API_KEY || '';
    this.baseUrl = env.LEMURA_BASE_URL || env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.model = env.LEMURA_MODEL || env.OPENAI_MODEL || 'gpt-4o-mini';

    // Agent Numeric Limits
    this.maxTokens = parseIntOpt(env.LEMURA_MAX_TOKENS || env.MAX_TOKENS) ?? 100000;
    this.maxIterations = parseIntOpt(env.LEMURA_MAX_ITERATIONS || env.MAX_ITERATIONS) ?? 8;
    this.maxSteps = parseIntOpt(env.LEMURA_MAX_STEPS || env.MAX_STEPS);
    this.maxCompletionTokens = parseIntOpt(env.LEMURA_MAX_COMPLETION_TOKENS || env.MAX_COMPLETION_TOKENS);

    // Agent Boolean Flags
    this.enableGoalPlanning = parseBoolOpt(env.LEMURA_ENABLE_GOAL_PLANNING || env.ENABLE_GOAL_PLANNING);
    this.enableGoalVerification = parseBoolOpt(env.LEMURA_ENABLE_GOAL_VERIFICATION || env.ENABLE_GOAL_VERIFICATION);
    this.enableContinuationPlanning = parseBoolOpt(env.LEMURA_ENABLE_CONTINUATION_PLANNING || env.ENABLE_CONTINUATION_PLANNING);
    this.parallelToolCalls = parseBoolOpt(env.LEMURA_PARALLEL_TOOL_CALLS || env.PARALLEL_TOOL_CALLS);
    this.enableRouting = parseBoolOpt(env.LEMURA_ENABLE_ROUTING || env.ENABLE_ROUTING);
  }

  validate() {
    if (!this.apiKey) {
      throw new Error(
        'No API key found. Set LEMURA_API_KEY (or OPENAI_API_KEY) in your environment or .env file.'
      );
    }
    return this;
  }
}

function parseIntOpt(val) {
  if (val === undefined || val === null || val === '') return undefined;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? undefined : parsed;
}

function parseBoolOpt(val) {
  if (val === undefined || val === null || val === '') return undefined;
  const s = String(val).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}
