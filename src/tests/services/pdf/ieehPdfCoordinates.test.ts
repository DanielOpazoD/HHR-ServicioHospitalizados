/**
 * IEEH PDF Coordinate Governance Test
 *
 * COORDINATES SOURCE: PDF field mapping tool, v3 (2026-02-23).
 */
import { describe, it, expect } from 'vitest';

const FIELD_COORDS = {
  primerApellido: { x: 51.48, y: 827.86, maxWidth: 137.82 },
  segundoApellido: { x: 238.46, y: 824.86, maxWidth: 118.68 },
  nombres: { x: 442.32, y: 827.11, maxWidth: 110.58 },
  nombreSocial: { x: 114.9, y: 804.28, maxWidth: 93.63 },
  tipoIdentificacion: { x: 111.31, y: 782.21, maxWidth: 11.03 },
  runDigits: { x: 57.01, y: 759.22, maxWidth: 87.72 },
  sexoRegistral: { x: 305.82, y: 781.46, maxWidth: 11.76 },
  nacDia: { x: 450.35, y: 800.54, maxWidth: 22.86 },
  nacMes: { x: 489.42, y: 799.04, maxWidth: 21.4 },
  nacAnio: { x: 524.05, y: 799.79, maxWidth: 50.84 },
  edad: { x: 79, y: 722.06, maxWidth: 35.36 },
  edadUnidad: { x: 181.04, y: 720.09, maxWidth: 10.67 },
  puebloIndigena: { x: 523.86, y: 750.12, maxWidth: 22.68 },
  prevision: { x: 54.37, y: 516.73, maxWidth: 10.67 },
  procedencia: { x: 225.78, y: 471.36, maxWidth: 10.67 },
  ingresoHora: { x: 102.35, y: 426.74, maxWidth: 22.68 },
  ingresoMin: { x: 136.36, y: 426.74, maxWidth: 21.33 },
  ingresoDia: { x: 181.71, y: 426.09, maxWidth: 22.68 },
  ingresoMes: { x: 215.72, y: 427.4, maxWidth: 23.35 },
  ingresoAnio: { x: 249.74, y: 426.09, maxWidth: 22.01 },
  egresoHora: { x: 91.68, y: 341.43, maxWidth: 21.33 },
  egresoMin: { x: 124.36, y: 341.34, maxWidth: 23.35 },
  egresoDia: { x: 169.04, y: 339.37, maxWidth: 22.68 },
  egresoMes: { x: 204.39, y: 341.43, maxWidth: 23.35 },
  egresoAnio: { x: 238.4, y: 340.03, maxWidth: 24.02 },
  diasEstada: { x: 103.69, y: 326.75, maxWidth: 45.35 },
  condicionEgreso: { x: 250.41, y: 327.4, maxWidth: 11.34 },
  diagnosticoPrincipal: { x: 167.08, y: 280.72, maxWidth: 341.48 },
  codigoCIE10: { x: 529.23, y: 281.38, maxWidth: 46.69 },
  especialidadMedico: { x: 327.77, y: 76.62, maxWidth: 151.42 },
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

  it('all fields have X within page bounds', () => {
    for (const [name, c] of entries) {
      expect(c.x, `${name}.x`).toBeGreaterThan(0);
      expect(c.x, `${name}.x`).toBeLessThan(PAGE_WIDTH);
    }
  });

  it('all fields have Y within page bounds', () => {
    for (const [name, c] of entries) {
      expect(c.y, `${name}.y`).toBeGreaterThan(0);
      expect(c.y, `${name}.y`).toBeLessThan(PAGE_HEIGHT);
    }
  });

  it('all fields have positive maxWidth within page', () => {
    for (const [name, c] of entries) {
      expect(c.maxWidth, `${name}.maxWidth`).toBeGreaterThan(0);
      expect(c.x + c.maxWidth, `${name} overflow`).toBeLessThanOrEqual(PAGE_WIDTH + 1);
    }
  });

  it('contains all required MINSAL fields', () => {
    const names = Object.keys(FIELD_COORDS);
    for (const r of REQUIRED_FIELDS) expect(names, `missing: ${r}`).toContain(r);
  });

  it('has at least 25 field definitions', () => {
    expect(entries.length).toBeGreaterThanOrEqual(25);
  });

  it('no duplicate positions', () => {
    const seen = new Map<string, string>();
    for (const [name, c] of entries) {
      const k = `${c.x},${c.y}`;
      expect(seen.has(k), `dup at (${k}): ${name} & ${seen.get(k)}`).toBe(false);
      seen.set(k, name);
    }
  });

  it('Egreso below Ingreso', () => {
    expect(FIELD_COORDS.egresoHora.y).toBeLessThan(FIELD_COORDS.ingresoHora.y);
  });

  it('Días Estada below Egreso', () => {
    expect(FIELD_COORDS.diasEstada.y).toBeLessThan(FIELD_COORDS.egresoHora.y);
  });

  it('Diagnóstico below Días Estada', () => {
    expect(FIELD_COORDS.diagnosticoPrincipal.y).toBeLessThan(FIELD_COORDS.diasEstada.y);
  });

  it('Especialidad near bottom (Y < 100)', () => {
    expect(FIELD_COORDS.especialidadMedico.y).toBeLessThan(100);
  });
});
