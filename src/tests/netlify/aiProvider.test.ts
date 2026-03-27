import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const generateContentMock = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent: (...args: unknown[]) => generateContentMock(...args),
    };
  },
}));

import {
  generateClinicalAIText,
  resolveClinicalAIProviderConfig,
} from '../../../netlify/functions/lib/ai-provider';

describe('ai-provider', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  it('resolves the explicitly configured provider', () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'openai-key';

    expect(resolveClinicalAIProviderConfig()).toMatchObject({
      provider: 'openai',
      apiKey: 'openai-key',
    });
  });

  it('generates text with Gemini', async () => {
    generateContentMock.mockResolvedValue({ text: 'respuesta gemini' });

    const result = await generateClinicalAIText({
      config: {
        provider: 'gemini',
        apiKey: 'gemini-key',
        model: 'gemini-3-flash-preview',
      },
      systemPrompt: 'Sistema',
      userPrompt: 'Usuario',
    });

    expect(result).toBe('respuesta gemini');
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it('generates text with OpenAI', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'respuesta openai' } }],
      }),
    } as Response);

    const result = await generateClinicalAIText({
      config: {
        provider: 'openai',
        apiKey: 'openai-key',
        model: 'gpt-4o-mini',
      },
      systemPrompt: 'Sistema',
      userPrompt: 'Usuario',
    });

    expect(result).toBe('respuesta openai');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('generates text with Anthropic', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'respuesta anthropic' }],
      }),
    } as Response);

    const result = await generateClinicalAIText({
      config: {
        provider: 'anthropic',
        apiKey: 'anthropic-key',
        model: 'claude-3-5-sonnet-latest',
      },
      systemPrompt: 'Sistema',
      userPrompt: 'Usuario',
    });

    expect(result).toBe('respuesta anthropic');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
