import { describe, expect, it } from 'vitest';
import {
  buildTransferQuestionnaireGroups,
  resolveTransferQuestionnaireGroupLabel,
} from '@/features/transfers/components/transferQuestionnairePresentation';
import type { HospitalConfig } from '@/types/transferDocuments';

describe('transferQuestionnairePresentation', () => {
  it('builds grouped questions only for enabled templates and visible groups', () => {
    const hospital: HospitalConfig = {
      id: 'hhr',
      name: 'Hospital Hanga Roa',
      code: 'HHR',
      emails: { to: [], cc: [] },
      templates: [
        { id: 'iaas', name: 'IAAS', format: 'pdf', enabled: true, requiredQuestions: [] },
        { id: 'hidden', name: 'Hidden', format: 'pdf', enabled: false, requiredQuestions: [] },
      ],
      questions: [
        { id: 'q1', label: 'Pregunta 1', type: 'text', required: false },
        { id: 'q2', label: 'Pregunta 2', type: 'text', required: false, group: 'iaas' },
        {
          id: 'q3',
          label: 'Pregunta 3',
          type: 'text',
          required: false,
          group: 'solicitud-ambulancia',
        },
      ],
    };

    expect(buildTransferQuestionnaireGroups(hospital)).toEqual({
      general: [{ id: 'q1', label: 'Pregunta 1', type: 'text', required: false }],
      iaas: [{ id: 'q2', label: 'Pregunta 2', type: 'text', required: false, group: 'iaas' }],
    });
    expect(resolveTransferQuestionnaireGroupLabel('formulario-iaas')).toBe('Formulario IAAS');
    expect(resolveTransferQuestionnaireGroupLabel('custom-group')).toBe('custom-group');
  });
});
