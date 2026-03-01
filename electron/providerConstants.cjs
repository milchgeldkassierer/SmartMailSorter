/**
 * AI provider string constants shared between main.cjs and TypeScript.
 * Keep in sync with LLMProvider enum in src/types.ts.
 */
const LLMProviders = Object.freeze({
  GEMINI: 'Google Gemini',
  OPENAI: 'OpenAI',
  ANTHROPIC: 'Anthropic',
  OLLAMA: 'Ollama',
});

module.exports = { LLMProviders };
