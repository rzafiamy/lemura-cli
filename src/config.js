export class Config {
  constructor(env = process.env) {
    this.apiKey = env.LEMURA_API_KEY || env.OPENAI_API_KEY || '';
    this.baseUrl = env.LEMURA_BASE_URL || env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.model = env.LEMURA_MODEL || env.OPENAI_MODEL || 'gpt-4o-mini';
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
