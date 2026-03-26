/**
 * AI-Enhanced CIE-10 Search Service
 *
 * Security model:
 * - Production: browser calls only serverless endpoint
 * - Local development: optional direct Gemini fallback using local-only env var
 */

import { CIE10Entry } from './cie10SpanishDatabase';
import { aiRequestManager } from '../ai/aiRequestManager';
import { GoogleGenAI } from '@google/genai';
import { recordOperationalErrorTelemetry } from '@/services/observability/operationalTelemetryService';
import { resolveCurrentUserAuthHeaders } from '@/services/auth/authRequestHeaders';

let aiAvailabilityChecked = false;
let aiIsAvailable = false;

const getLocalDevApiKey = (): string | undefined => {
  if (!import.meta.env.DEV) return undefined;
  const key = import.meta.env.VITE_LOCAL_GEMINI_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : undefined;
};

const parseAIResults = (rawText: string): CIE10Entry[] => {
  const text = rawText.trim();
  if (!text) return [];

  let jsonText = text;
  if (text.startsWith('```')) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    jsonText = match ? match[1].trim() : text;
  }

  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(
      item =>
        item &&
        typeof item.code === 'string' &&
        typeof item.description === 'string' &&
        item.code.trim().length > 0 &&
        item.description.trim().length > 0
    )
    .map(item => ({
      code: item.code,
      description: item.description,
      category: typeof item.category === 'string' ? item.category : 'IA',
    }));
};

async function searchWithServerlessFunction(
  query: string,
  signal?: AbortSignal
): Promise<{ available: boolean; results: CIE10Entry[] }> {
  try {
    const authHeaders = await resolveCurrentUserAuthHeaders();
    const response = await fetch('/.netlify/functions/cie10-ai-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ query }),
      signal,
    });

    if (!response.ok) {
      return { available: false, results: [] };
    }

    const data = await response.json();
    return {
      available: data.available === true,
      results: data.results || [],
    };
  } catch {
    return { available: false, results: [] };
  }
}

const buildLocalPrompt = (query: string): string => `
Eres un codificador experto de CIE-10 (Clasificación Internacional de Enfermedades, 10a edición) en español, trabajando para el Hospital Hanga Roa en Rapa Nui (Isla de Pascua).

TU TAREA: Dada la consulta del usuario: "${query}", devuelve hasta 8 códigos CIE-10 que mejor representen el diagnóstico clínico.

CONSIDERACIONES CRÍTICAS:
1. ABREVIACIONES MÉDICAS CHILENAS: Interpretación obligatoria:
   - IAM: Infarto agudo del miocardio (I21.9)
   - ACV / AVE: Accidente cerebrovascular (I63.9 o I64)
   - NAC: Neumonía adquirida en la comunidad (J18.9)
   - TVP: Trombosis venosa profunda (I82.4)
   - ITU: Infección del tracto urinario (N39.0)
   - HTA: Hipertensión arterial (I10)
   - DM / DM2: Diabetes mellitus (E11.9)
   - EPOC: Enfermedad pulmonar obstructiva crónica (J44.9)
   - AKI / IRA: Lesión renal aguda (N17.9)
   - TEP: Tromboembolismo pulmonar (I26.9)
   - GEA: Gastroenteritis aguda (A09.9)
   - TEC: Traumatismo encéfalo craneano (S06.9)
   - UPC: Unidad de Paciente Crítico (contexto grave)

2. CONTEXTO RAPA NUI:
   - "Dengue": A90
   - "Zika": A92.8
   - "Mordedura de perro": W54.0

3. CALIDAD DE RESPUESTA:
   - Responde ÚNICAMENTE con un array JSON válido.
   - Cada objeto debe tener: "code", "description" (en español formal), "category" (agregación médica).
   - No incluyas markdown, bloques de código \`\`\`json, ni texto explicativo.

Ejemplo:
[
  {"code": "I21.9", "description": "Infarto agudo del miocardio, sin otra especificación", "category": "Cardiovasculares"},
  {"code": "I10", "description": "Hipertensión esencial (primaria)", "category": "Cardiovasculares"}
]
`;

async function searchWithLocalDevAPI(query: string, signal?: AbortSignal): Promise<CIE10Entry[]> {
  const apiKey = getLocalDevApiKey();
  if (!apiKey || signal?.aborted) return [];

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: buildLocalPrompt(query),
    });

    return parseAIResults(response.text || '');
  } catch (error) {
    recordOperationalErrorTelemetry('integration', 'cie10_ai_local_fallback', error, {
      code: 'cie10_ai_local_fallback_failed',
      message: 'Fallo el fallback local de IA para CIE-10.',
      severity: 'warning',
      userSafeMessage: 'La busqueda IA local no esta disponible en este momento.',
      context: { devMode: import.meta.env.DEV },
    });
    return [];
  }
}

export function isAIAvailable(): boolean {
  return aiIsAvailable;
}

export async function searchCIE10WithAI(
  query: string,
  signal?: AbortSignal
): Promise<CIE10Entry[]> {
  if (!query || query.length < 2) return [];

  return aiRequestManager.enqueue(
    `cie10-${query}`,
    async innerSignal => {
      const joinedSignal = innerSignal || signal;
      const serverlessResult = await searchWithServerlessFunction(query, joinedSignal);

      if (serverlessResult.available) {
        aiAvailabilityChecked = true;
        aiIsAvailable = true;
        return serverlessResult.results;
      }

      const localResults = await searchWithLocalDevAPI(query, joinedSignal);
      if (localResults.length > 0) {
        aiAvailabilityChecked = true;
        aiIsAvailable = true;
        return localResults;
      }

      aiAvailabilityChecked = true;
      aiIsAvailable = false;
      return [];
    },
    signal
  );
}

export async function checkAIAvailability(): Promise<boolean> {
  if (aiAvailabilityChecked) {
    return aiIsAvailable;
  }

  try {
    const authHeaders = await resolveCurrentUserAuthHeaders();
    const response = await fetch('/.netlify/functions/cie10-ai-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ query: '' }),
    });

    if (response.ok) {
      const data = await response.json();
      const isAvailable = data.available === true;
      aiAvailabilityChecked = true;
      aiIsAvailable = isAvailable;
      if (isAvailable) return true;
    }
  } catch {
    // Serverless unavailable in local dev
  }

  const hasLocalFallback = Boolean(getLocalDevApiKey());
  aiAvailabilityChecked = true;
  aiIsAvailable = hasLocalFallback;
  return hasLocalFallback;
}
