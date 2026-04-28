import { describe, expect, it } from 'vitest';

import {
  buildClinicalDocumentAiImportSections,
  parseClinicalDocumentAiImportJson,
  validateClinicalDocumentAiImportFile,
  validateClinicalDocumentAiImportSourceText,
} from '@/features/clinical-documents/controllers/clinicalDocumentAiImportController';

describe('clinicalDocumentAiImportController', () => {
  it('parses simplified AI JSON and rejects missing clinical sections', () => {
    const parsed = parseClinicalDocumentAiImportJson(
      JSON.stringify({
        antecedentes: 'HTA.',
        historiaEvolucionClinica: 'Traslado por neumonia.',
        examenesComplementarios: '',
        diagnosticosEgreso: 'Neumonia adquirida en la comunidad.',
        planEgreso: 'Continuar manejo antibiotico en hospital receptor.',
      })
    );

    expect(parsed.status).toBe('success');
    expect(parsed.data?.planEgreso).toBe('Continuar manejo antibiotico en hospital receptor.');

    const invalid = parseClinicalDocumentAiImportJson('{"antecedentes":"HTA"}');

    expect(invalid.status).toBe('failed');
    if (invalid.status === 'failed') {
      expect(invalid.error).toContain('respuesta IA');
    }
  });

  it('removes administrative patient identifiers from parsed import sections', () => {
    const parsed = parseClinicalDocumentAiImportJson(
      JSON.stringify({
        antecedentes:
          'Nombre completo: Juan Perez Hanga.\nRUT: 12.345.678-9\nHTA. Diabetes mellitus tipo 2.',
        historiaEvolucionClinica: 'Paciente: Maria Rapa Nui.\nEvoluciona estable durante traslado.',
        examenesComplementarios: 'RUN: 9.876.543-K\nRadiografia de torax compatible.',
        diagnosticosEgreso: 'Neumonia.',
        planEgreso: 'Continuar manejo antibiotico en centro receptor.',
      })
    );

    expect(parsed.status).toBe('success');
    expect(parsed.data?.antecedentes).toBe('HTA. Diabetes mellitus tipo 2.');
    expect(parsed.data?.historiaEvolucionClinica).toBe('Evoluciona estable durante traslado.');
    expect(parsed.data?.examenesComplementarios).toBe('Radiografia de torax compatible.');
  });

  it('maps simplified import JSON to epicrisis traslado sections with safe HTML', () => {
    const sections = buildClinicalDocumentAiImportSections({
      antecedentes: 'HTA <controlada>',
      historiaEvolucionClinica: 'Dia 1: estable.\nDia 2: traslado.',
      examenesComplementarios: '',
      diagnosticosEgreso: 'Neumonia',
      planEgreso: 'Continuar tratamiento en centro receptor.',
    });

    expect(sections).toEqual([
      {
        id: 'antecedentes',
        title: 'Antecedentes',
        content: '<p>HTA &lt;controlada&gt;</p>',
        order: 0,
        required: true,
        visible: true,
      },
      {
        id: 'historia-evolucion',
        title: 'Historia y evolución clínica',
        content: '<p>Dia 1: estable.<br>Dia 2: traslado.</p>',
        order: 1,
        required: true,
        visible: true,
      },
      {
        id: 'examenes-complementarios',
        title: 'Exámenes complementarios',
        content: '',
        order: 2,
        required: false,
        visible: true,
      },
      {
        id: 'diagnosticos',
        title: 'Diagnósticos de egreso',
        content: '<p>Neumonia</p>',
        order: 3,
        required: false,
        visible: true,
      },
      {
        id: 'plan',
        title: 'Plan de egreso',
        content: '<p>Continuar tratamiento en centro receptor.</p>',
        order: 4,
        required: true,
        visible: true,
      },
    ]);
  });

  it('validates supported source files before extraction', () => {
    expect(
      validateClinicalDocumentAiImportFile({
        name: 'traslado.pdf',
        type: 'application/pdf',
        size: 1024,
      })
    ).toEqual({ ok: true });

    expect(
      validateClinicalDocumentAiImportFile({
        name: 'imagen.png',
        type: 'image/png',
        size: 1024,
      })
    ).toMatchObject({
      ok: false,
      message: 'Solo se aceptan archivos PDF o DOCX para importar con IA.',
    });

    expect(
      validateClinicalDocumentAiImportFile({
        name: 'traslado.pdf',
        type: 'application/pdf',
        size: 9 * 1024 * 1024,
      })
    ).toMatchObject({
      ok: false,
      message: 'El archivo supera el maximo permitido de 8 MB.',
    });
  });

  it('validates extracted source text before calling AI', () => {
    expect(validateClinicalDocumentAiImportSourceText('Traslado'.repeat(20))).toEqual({
      ok: true,
    });

    expect(validateClinicalDocumentAiImportSourceText('   ')).toMatchObject({
      ok: false,
      message: 'No se pudo extraer texto util del archivo.',
    });
  });
});
