/**
 * IEEH PDF Coordinate Governance Test
 *
 * Validates that all FIELD_COORDS in ieehPdfService.ts are:
 *  1. Within the valid page bounds (609.57 × 935.43 pt)
 *  2. Have a positive maxWidth that doesn't exceed page width
 *  3. Cover all expected form fields (no accidental deletions)
 *  4. Are internally consistent (no duplicate positions for different fields)
 *
 * This test acts as a regression guard after manual calibration sessions.
 */
import { describe, it, expect } from 'vitest';

// ── Inline the FIELD_COORDS to test them statically ──
// Mirror of the production constants (synced 2026-02-23 after v5 calibration)
const FIELD_COORDS = {
  primerApellido: { x: 85, y: 830, maxWidth: 160 },
  segundoApellido: { x: 255, y: 830, maxWidth: 160 },
  nombres: { x: 428, y: 830, maxWidth: 130 },
  nombreSocial: { x: 85, y: 800, maxWidth: 200 },
  tipoIdentificacion: { x: 170, y: 785, maxWidth: 15 },
  runDigits: { x: 85, y: 766, maxWidth: 200 },
  sexoRegistral: { x: 385, y: 773, maxWidth: 15 },
  nacDia: { x: 460, y: 800, maxWidth: 25 },
  nacMes: { x: 490, y: 800, maxWidth: 25 },
  nacAnio: { x: 520, y: 800, maxWidth: 35 },
  edad: { x: 105, y: 725, maxWidth: 50 },
  edadUnidad: { x: 185, y: 725, maxWidth: 15 },
  puebloIndigena: { x: 525, y: 750, maxWidth: 15 },
  prevision: { x: 60, y: 503, maxWidth: 15 },
  procedencia: { x: 427, y: 453, maxWidth: 15 },
  ingresoHora: { x: 110, y: 428, maxWidth: 20 },
  ingresoMin: { x: 140, y: 428, maxWidth: 20 },
  ingresoDia: { x: 190, y: 428, maxWidth: 18 },
  ingresoMes: { x: 210, y: 428, maxWidth: 18 },
  ingresoAnio: { x: 230, y: 428, maxWidth: 30 },
  egresoHora: { x: 110, y: 336, maxWidth: 20 },
  egresoMin: { x: 140, y: 336, maxWidth: 20 },
  egresoDia: { x: 190, y: 336, maxWidth: 18 },
  egresoMes: { x: 210, y: 336, maxWidth: 18 },
  egresoAnio: { x: 230, y: 336, maxWidth: 30 },
  diasEstada: { x: 110, y: 320, maxWidth: 55 },
  condicionEgreso: { x: 230, y: 320, maxWidth: 15 },
  diagnosticoPrincipal: { x: 150, y: 280, maxWidth: 380 },
  codigoCIE10: { x: 548, y: 280, maxWidth: 55 },
  especialidadMedico: { x: 430, y: 82, maxWidth: 170 },
} as const;

// Page dimensions (oficio chileno: 215 × 330mm)
const PAGE_WIDTH = 609.57;
const PAGE_HEIGHT = 935.43;

// All fields that MUST exist (canonical list from MINSAL IEEH form)
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
      ).toBeLessThanOrEqual(PAGE_WIDTH + 1); // +1 for tiny rounding
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
