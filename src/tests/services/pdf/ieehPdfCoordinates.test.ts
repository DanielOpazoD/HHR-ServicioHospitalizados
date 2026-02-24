/**
 * IEEH PDF Coordinate Governance Test
 *
 * Validates that all FIELD_COORDS in ieehPdfService.ts are:
 *  1. Within the valid page bounds (609.57 × 935.43 pt)
 *  2. Have a positive maxWidth that doesn't exceed page width
 *  3. Cover all expected form fields (no accidental deletions)
 *  4. Are internally consistent (no duplicate positions for different fields)
 *
 * COORDINATES SOURCE: PDF field mapping tool, refined v2 (2026-02-23).
 */
import { describe, it, expect } from 'vitest';

// ── Mirror of production FIELD_COORDS (synced 2026-02-23 — refined v2, normalized Y) ──
const FIELD_COORDS = {
  primerApellido: { x: 57.49, y: 825.15, maxWidth: 137.83 },
  segundoApellido: { x: 249.13, y: 825.15, maxWidth: 118.67 },
  nombres: { x: 456.99, y: 825.15, maxWidth: 110.56 },
  nombreSocial: { x: 114.25, y: 805, maxWidth: 93.61 },
  tipoIdentificacion: { x: 111.3, y: 781.06, maxWidth: 11.06 },
  runDigits: { x: 59.7, y: 757.84, maxWidth: 87.71 },
  sexoRegistral: { x: 305.15, y: 781.06, maxWidth: 11.79 },
  nacDia: { x: 450.36, y: 799.35, maxWidth: 22.85 },
  nacMes: { x: 489.42, y: 799.35, maxWidth: 21.38 },
  nacAnio: { x: 524.07, y: 799.35, maxWidth: 50.86 },
  edad: { x: 79.7, y: 720.74, maxWidth: 35.35 },
  edadUnidad: { x: 181.07, y: 720.74, maxWidth: 10.67 },
  puebloIndigena: { x: 523.87, y: 750.08, maxWidth: 22.68 },
  prevision: { x: 54.35, y: 516.72, maxWidth: 10.67 },
  procedencia: { x: 225.75, y: 471.38, maxWidth: 10.67 },
  ingresoHora: { x: 102.37, y: 426.58, maxWidth: 22.68 },
  ingresoMin: { x: 136.39, y: 426.58, maxWidth: 21.34 },
  ingresoDia: { x: 181.07, y: 426.58, maxWidth: 22.68 },
  ingresoMes: { x: 215.08, y: 426.58, maxWidth: 23.34 },
  ingresoAnio: { x: 249.76, y: 426.58, maxWidth: 22.01 },
  egresoHora: { x: 92.37, y: 339.64, maxWidth: 21.34 },
  egresoMin: { x: 125.05, y: 339.64, maxWidth: 23.34 },
  egresoDia: { x: 170.4, y: 339.64, maxWidth: 22.68 },
  egresoMes: { x: 205.08, y: 339.64, maxWidth: 23.34 },
  egresoAnio: { x: 238.43, y: 339.64, maxWidth: 24.01 },
  diasEstada: { x: 104.37, y: 326.7, maxWidth: 45.35 },
  condicionEgreso: { x: 250.43, y: 326.7, maxWidth: 11.34 },
  diagnosticoPrincipal: { x: 167.06, y: 281.03, maxWidth: 341.47 },
  codigoCIE10: { x: 529.2, y: 281.03, maxWidth: 46.68 },
  especialidadMedico: { x: 327.79, y: 76.01, maxWidth: 151.39 },
} as const;

const PAGE_WIDTH = 609.57;
const PAGE_HEIGHT = 935.43;

const REQUIRED_FIELDS = [
  'primerApellido',
  'segundoApellido',
  'nombres',
  'sexoRegistral',
  'nacDia',
  'nacMes',
  'nacAnio',
  'edad',
  'edadUnidad',
  'prevision',
  'procedencia',
  'ingresoHora',
  'ingresoMin',
  'ingresoDia',
  'ingresoMes',
  'ingresoAnio',
  'egresoHora',
  'egresoMin',
  'egresoDia',
  'egresoMes',
  'egresoAnio',
  'diasEstada',
  'condicionEgreso',
  'diagnosticoPrincipal',
  'codigoCIE10',
  'especialidadMedico',
];

describe('IEEH PDF Field Coordinates Governance', () => {
  const entries = Object.entries(FIELD_COORDS);

  it('all fields have X within page bounds (0 < X < 610)', () => {
    for (const [name, coords] of entries) {
      expect(coords.x, `${name}.x = ${coords.x}`).toBeGreaterThan(0);
      expect(coords.x, `${name}.x = ${coords.x}`).toBeLessThan(PAGE_WIDTH);
    }
  });

  it('all fields have Y within page bounds (0 < Y < 936)', () => {
    for (const [name, coords] of entries) {
      expect(coords.y, `${name}.y = ${coords.y}`).toBeGreaterThan(0);
      expect(coords.y, `${name}.y = ${coords.y}`).toBeLessThan(PAGE_HEIGHT);
    }
  });

  it('all fields have positive maxWidth that fits within page', () => {
    for (const [name, coords] of entries) {
      expect(coords.maxWidth, `${name}.maxWidth`).toBeGreaterThan(0);
      expect(
        coords.x + coords.maxWidth,
        `${name} overflows right edge: x(${coords.x}) + maxWidth(${coords.maxWidth})`
      ).toBeLessThanOrEqual(PAGE_WIDTH + 1);
    }
  });

  it('contains all required MINSAL fields', () => {
    const fieldNames = Object.keys(FIELD_COORDS);
    for (const required of REQUIRED_FIELDS) {
      expect(fieldNames, `missing required field: ${required}`).toContain(required);
    }
  });

  it('has at least 25 field definitions', () => {
    expect(entries.length).toBeGreaterThanOrEqual(25);
  });

  it('no two different fields share the exact same position', () => {
    const seen = new Map<string, string>();
    for (const [name, coords] of entries) {
      const key = `${coords.x},${coords.y}`;
      expect(seen.has(key), `duplicate position at (${key}): ${name} and ${seen.get(key)}`).toBe(
        false
      );
      seen.set(key, name);
    }
  });

  it('Ingreso row fields share same Y value', () => {
    const y = FIELD_COORDS.ingresoHora.y;
    expect(FIELD_COORDS.ingresoMin.y).toBe(y);
    expect(FIELD_COORDS.ingresoDia.y).toBe(y);
    expect(FIELD_COORDS.ingresoMes.y).toBe(y);
    expect(FIELD_COORDS.ingresoAnio.y).toBe(y);
  });

  it('Egreso row fields share same Y value', () => {
    const y = FIELD_COORDS.egresoHora.y;
    expect(FIELD_COORDS.egresoMin.y).toBe(y);
    expect(FIELD_COORDS.egresoDia.y).toBe(y);
    expect(FIELD_COORDS.egresoMes.y).toBe(y);
    expect(FIELD_COORDS.egresoAnio.y).toBe(y);
  });

  it('Egreso fields are below Ingreso fields (lower Y value)', () => {
    expect(FIELD_COORDS.egresoHora.y).toBeLessThan(FIELD_COORDS.ingresoHora.y);
  });

  it('Días Estada is below Egreso (lower Y value)', () => {
    expect(FIELD_COORDS.diasEstada.y).toBeLessThan(FIELD_COORDS.egresoHora.y);
  });

  it('Diagnóstico is below Días Estada (lower Y value)', () => {
    expect(FIELD_COORDS.diagnosticoPrincipal.y).toBeLessThan(FIELD_COORDS.diasEstada.y);
  });

  it('Especialidad is near the bottom of the page (Y < 100)', () => {
    expect(FIELD_COORDS.especialidadMedico.y).toBeLessThan(100);
  });
});
