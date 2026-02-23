/**
 * Tests: Motor de Búsqueda Local CIE-10 (searchCIE10Spanish)
 *
 * FLUJO: El usuario escribe un diagnóstico libre (ej: "diabetes", "HTA", "fractura cadera").
 * La función searchCIE10Spanish() busca instantáneamente en la base local de ~8,500 diagnósticos CIE-10.
 *
 * SEÑALES DE SCORING (de mayor a menor prioridad):
 *  1. Código exacto (200pts): "I10" → Hipertensión esencial
 *  2. Prefijo de código (150pts): "I1" → I10.X, I11.9, etc.
 *  3. Substring en descripción (80pts): "diabetes" encuentra todas las entradas con esa palabra
 *  4. Ratio de tokens (50pts): "fractura femur" matchea descripciones que contienen ambas palabras
 *  5. Sinónimos médicos (70pts): "HTA" → expande a "hipertensión" y encuentra I10
 *  6. Fuzzy fallback (Levenshtein): "diabetez" → corrige a "diabetes" (tolerancia a errores)
 *
 * RESULTADO ESPERADO: Array de CIE10Entry[] ordenado por relevancia, máximo 15 resultados.
 */
import { describe, it, expect } from 'vitest';
import {
  searchCIE10Spanish,
  CIE10_SPANISH_DATABASE,
} from '@/services/terminology/cie10SpanishDatabase';

/** Helper: normaliza texto para comparaciones (remueve acentos + lowercase) */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

describe('Motor de Búsqueda Local CIE-10 (searchCIE10Spanish)', () => {
  // ── Base de datos ──
  describe('Base de datos local', () => {
    it('debe contener más de 8,000 diagnósticos CIE-10 importados del Excel', () => {
      expect(CIE10_SPANISH_DATABASE.length).toBeGreaterThan(8000);
    });

    it('cada entrada debe tener code, description y category', () => {
      const sample = CIE10_SPANISH_DATABASE.slice(0, 100);
      for (const entry of sample) {
        expect(entry.code).toBeDefined();
        expect(entry.description).toBeDefined();
        expect(entry.category).toBeDefined();
      }
    });
  });

  // ── Validaciones de entrada ──
  describe('Validaciones de entrada', () => {
    it('retorna [] si la consulta tiene menos de 2 caracteres', () => {
      expect(searchCIE10Spanish('')).toEqual([]);
      expect(searchCIE10Spanish('a')).toEqual([]);
    });

    it('retorna [] si la consulta es undefined/null', () => {
      expect(searchCIE10Spanish(undefined as unknown as string)).toEqual([]);
      expect(searchCIE10Spanish(null as unknown as string)).toEqual([]);
    });
  });

  // ── Búsqueda por código CIE-10 ──
  describe('Señal 1: Búsqueda por código CIE-10', () => {
    it('encuentra resultados por código: "A09" → códigos que empiezan con A09', () => {
      const results = searchCIE10Spanish('A09');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].code).toMatch(/^A09/);
    });

    it('encuentra por prefijo de código: "I10" → códigos de hipertensión (I10.x)', () => {
      const results = searchCIE10Spanish('I10');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].code).toMatch(/^I10/);
      expect(normalize(results[0].description)).toContain('hipertension');
    });

    it('encuentra por prefijo parcial: "J18" → Neumonías J18.x', () => {
      const results = searchCIE10Spanish('J18');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].code).toMatch(/^J18/);
    });
  });

  // ── Búsqueda por texto de descripción ──
  describe('Señal 2-3: Búsqueda por texto de descripción', () => {
    it('encuentra por descripción completa: "diabetes" → resultados con "diabetes"', () => {
      const results = searchCIE10Spanish('diabetes');
      expect(results.length).toBeGreaterThan(0);
      expect(normalize(results[0].description)).toContain('diabetes');
    });

    it('encuentra por prefijo de palabra: "neumo" → neumonía, neumotórax, etc.', () => {
      const results = searchCIE10Spanish('neumo');
      expect(results.length).toBeGreaterThan(0);
      const allContainPrefix = results.every(r => normalize(r.description).includes('neumo'));
      expect(allContainPrefix).toBe(true);
    });

    it('búsqueda multipalabra: "fractura cuello" → prioriza resultados con ambas palabras', () => {
      const results = searchCIE10Spanish('fractura cuello');
      expect(results.length).toBeGreaterThan(0);
      const topResult = normalize(results[0].description);
      expect(topResult).toContain('fractura');
      expect(topResult).toContain('cuello');
    });
  });

  // ── Búsqueda por sinónimos médicos chilenos ──
  describe('Señal 4: Sinónimos y abreviaciones médicas', () => {
    it('"HTA" → expande a hipertensión arterial', () => {
      const results = searchCIE10Spanish('HTA');
      expect(results.length).toBeGreaterThan(0);
      expect(normalize(results[0].description)).toContain('hipertension');
    });

    it('"diabetes" → expande con sinónimo a "diabetes mellitus"', () => {
      const results = searchCIE10Spanish('diabetes');
      expect(results.length).toBeGreaterThan(0);
      expect(normalize(results[0].description)).toContain('diabetes');
    });

    it('"EPOC" → expande a enfermedad pulmonar obstructiva', () => {
      const results = searchCIE10Spanish('EPOC');
      expect(results.length).toBeGreaterThan(0);
      // La descripción puede tener acento: "pulmónar" → normalizado "pulmonar"
      const hasEPOC = results.some(
        r =>
          normalize(r.description).includes('pulmon') &&
          normalize(r.description).includes('obstructiv')
      );
      expect(hasEPOC).toBe(true);
    });

    it('"infarto" → encuentra infarto agudo de miocardio', () => {
      const results = searchCIE10Spanish('infarto');
      expect(results.length).toBeGreaterThan(0);
      expect(normalize(results[0].description)).toContain('infarto');
    });
  });

  // ── Tolerancia a errores de escritura ──
  describe('Señal 5: Fuzzy matching (tolerancia a errores)', () => {
    it('"diabetez" (con z) → encuentra "diabetes" por similitud', () => {
      const results = searchCIE10Spanish('diabetez');
      expect(results.length).toBeGreaterThan(0);
      expect(normalize(results[0].description)).toContain('diabetes');
    });
  });

  // ── Límite de resultados ──
  describe('Límites', () => {
    it('nunca retorna más de 15 resultados', () => {
      const results = searchCIE10Spanish('fractura');
      expect(results.length).toBeLessThanOrEqual(15);
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
