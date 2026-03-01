import { GoogleGenAI } from '@google/genai';

const getGeminiApiKey = () =>
  import.meta.env.VITE_LOCAL_GEMINI_API_KEY ||
  import.meta.env.VITE_GEMINI_API_KEY ||
  import.meta.env.VITE_API_KEY;

export const createGeminiClient = () => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('API Key is missing. Please set VITE_LOCAL_GEMINI_API_KEY in your .env.local.');
  }

  return new GoogleGenAI({ apiKey });
};

export const generateGeminiHtmlContent = async (prompt: string): Promise<string | undefined> => {
  const ai = createGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });
  return response.text;
};
