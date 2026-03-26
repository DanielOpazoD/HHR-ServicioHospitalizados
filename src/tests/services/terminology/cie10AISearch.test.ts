/**
 * Tests: Búsqueda IA CIE-10 (cie10AISearch)
 *
 * FLUJO DE FALLBACK:
 * ┌──────────────────────────────────────────────────────────┐
 * │ 1. Intenta endpoint serverless (Netlify Functions)      │
 * │    POST /.netlify/functions/cie10-ai-search              │
 * │    → Si responde available:true → usa esos resultados   │
 * │                                                          │
 * │ 2. Si serverless NO disponible (404 en local dev):      │
 * │    → Fallback directo a Gemini API con key local        │
 * │    → Usa VITE_LOCAL_GEMINI_API_KEY de .env.local        │
 * │    → Modelo: gemini-3-flash-preview                     │
 * │                                                          │
 * │ 3. Si ninguno funciona → retorna []                     │
 * └──────────────────────────────────────────────────────────┘
 *
 * FUNCIONES EXPORTADAS:
 *  - searchCIE10WithAI(query, signal?) → CIE10Entry[]
 *  - checkAIAvailability() → boolean
 *  - isAIAvailable() → boolean (sync, cached)
 *
 * SEGURIDAD:
 *  - En producción: SOLO usa endpoint serverless (key nunca en frontend)
 *  - En desarrollo: fallback directo a Gemini con key local en .env.local
 *  - API key NUNCA se commitea a Git (.env.local está en .gitignore)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cie10Module from '@/services/terminology/cie10AISearch';

// Mock AI Request Manager — simula el rate limiter
vi.mock('../ai/aiRequestManager', () => ({
  aiRequestManager: {
    enqueue: vi.fn((_id, fn) => fn()),
  },
}));

vi.mock('@/services/auth/authRequestHeaders', () => ({
  resolveCurrentUserAuthHeaders: vi.fn().mockResolvedValue({
    Authorization: 'Bearer token-123',
  }),
}));

// Mock fetch — simula el endpoint serverless de Netlify
global.fetch = vi.fn();
const mockFetch = vi.mocked(global.fetch);

// Mock @google/genai — simula respuesta de Gemini API
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify([{ code: 'A00', description: 'Cólera', category: 'Infecciosas' }]),
        }),
      };
      constructor(_config: { apiKey: string }) {}
    },
  };
});

describe('Búsqueda IA CIE-10 (cie10AISearch)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Validaciones de entrada ──
  describe('Validaciones de entrada', () => {
    it('retorna [] si la consulta tiene menos de 2 caracteres', async () => {
      const result = await cie10Module.searchCIE10WithAI('a');
      expect(result).toEqual([]);
    });
  });

  // ── checkAIAvailability: verificación de disponibilidad ──
  describe('checkAIAvailability() — Verificar si IA está disponible', () => {
    it('retorna true si el endpoint serverless responde available:true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ available: true }),
      } as Response);

      const available = await cie10Module.checkAIAvailability();
      expect(available).toBe(true);
    });
  });

  // ── searchCIE10WithAI: búsqueda principal ──
  describe('searchCIE10WithAI() — Búsqueda con cadena de fallback', () => {
    it('usa resultados de serverless si está disponible', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          available: true,
          results: [{ code: 'B01', description: 'Varicela' }],
        }),
      } as Response);

      const results = await cie10Module.searchCIE10WithAI('varicela');

      expect(results).toEqual([{ code: 'B01', description: 'Varicela' }]);
    });

    it('retorna [] si serverless no disponible Y no hay API key local', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ available: false }),
      } as Response);

      vi.stubEnv('VITE_LOCAL_GEMINI_API_KEY', '');

      const results = await cie10Module.searchCIE10WithAI('query-sin-key');
      vi.unstubAllEnvs();

      expect(results).toEqual([]);
    });

    it('usa fallback local (Gemini directo) cuando serverless no disponible Y hay API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ available: false }),
      } as Response);

      vi.stubEnv('VITE_LOCAL_GEMINI_API_KEY', 'test-local-key');
      const results = await cie10Module.searchCIE10WithAI('colera');
      vi.unstubAllEnvs();

      // Usa el mock de GoogleGenAI que retorna cólera
      expect(results).toEqual([{ code: 'A00', description: 'Cólera', category: 'Infecciosas' }]);
    });
  });
});
