import { GoogleGenAI } from '@google/genai';

export type ClinicalAIProvider = 'gemini' | 'openai' | 'anthropic';

export interface ClinicalAIProviderConfig {
  provider: ClinicalAIProvider;
  apiKey: string;
  model: string;
}

export interface GenerateClinicalAITextParams {
  config: ClinicalAIProviderConfig;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

const DEFAULT_PROVIDER_MODELS: Record<ClinicalAIProvider, string> = {
  gemini: 'gemini-3-flash-preview',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-latest',
};

const normalizeProvider = (value: string | undefined): ClinicalAIProvider | null => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'gemini' || normalized === 'openai' || normalized === 'anthropic') {
    return normalized;
  }
  return null;
};

export const resolveClinicalAIProviderConfig = (
  env: NodeJS.ProcessEnv = process.env
): ClinicalAIProviderConfig | null => {
  const explicitProvider = normalizeProvider(env.AI_PROVIDER);
  const geminiKey = env.GEMINI_API_KEY || env.API_KEY;
  const openaiKey = env.OPENAI_API_KEY;
  const anthropicKey = env.ANTHROPIC_API_KEY;

  const buildConfig = (provider: ClinicalAIProvider, apiKey: string | undefined, model?: string) =>
    apiKey?.trim()
      ? {
          provider,
          apiKey: apiKey.trim(),
          model: model?.trim() || DEFAULT_PROVIDER_MODELS[provider],
        }
      : null;

  if (explicitProvider === 'gemini') {
    return buildConfig('gemini', geminiKey, env.GEMINI_MODEL);
  }
  if (explicitProvider === 'openai') {
    return buildConfig('openai', openaiKey, env.OPENAI_MODEL);
  }
  if (explicitProvider === 'anthropic') {
    return buildConfig('anthropic', anthropicKey, env.ANTHROPIC_MODEL);
  }

  return (
    buildConfig('gemini', geminiKey, env.GEMINI_MODEL) ||
    buildConfig('openai', openaiKey, env.OPENAI_MODEL) ||
    buildConfig('anthropic', anthropicKey, env.ANTHROPIC_MODEL)
  );
};

const parseOpenAIContent = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const text = (item as { text?: string }).text;
          if (typeof text === 'string') return text;
        }
        return '';
      })
      .join('\n')
      .trim();
  }

  return '';
};

const parseAnthropicContent = (value: unknown): string => {
  if (!Array.isArray(value)) {
    return '';
  }

  return value
    .map(item => {
      if (!item || typeof item !== 'object') return '';
      const block = item as { type?: string; text?: string };
      return block.type === 'text' && typeof block.text === 'string' ? block.text : '';
    })
    .join('\n')
    .trim();
};

const generateGeminiText = async ({
  config,
  systemPrompt,
  userPrompt,
}: GenerateClinicalAITextParams): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const response = await ai.models.generateContent({
    model: config.model,
    contents: `${systemPrompt}\n\n${userPrompt}`,
  });

  return response.text?.trim() || '';
};

const generateOpenAIText = async ({
  config,
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  maxTokens = 1200,
}: GenerateClinicalAITextParams): Promise<string> => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${message}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };

  return parseOpenAIContent(payload.choices?.[0]?.message?.content);
};

const generateAnthropicText = async ({
  config,
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  maxTokens = 1200,
}: GenerateClinicalAITextParams): Promise<string> => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      system: systemPrompt,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Anthropic request failed (${response.status}): ${message}`);
  }

  const payload = (await response.json()) as {
    content?: unknown;
  };

  return parseAnthropicContent(payload.content);
};

export const generateClinicalAIText = async (
  params: GenerateClinicalAITextParams
): Promise<string> => {
  if (params.config.provider === 'gemini') {
    return generateGeminiText(params);
  }

  if (params.config.provider === 'openai') {
    return generateOpenAIText(params);
  }

  return generateAnthropicText(params);
};
