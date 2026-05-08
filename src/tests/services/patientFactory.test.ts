import { describe, expect, it } from 'vitest';
import { EMPTY_PATIENT } from '@/constants/patient';
import { createEmptyPatient } from '@/services/factories/patientFactory';
import type { PatientData } from '@/types/domain/patient';

describe('createEmptyPatient', () => {
  it('does not carry episode anchors from the shared empty-patient template', () => {
    const template = EMPTY_PATIENT as Partial<PatientData>;
    const previousFirstSeenDate = template.firstSeenDate;

    template.firstSeenDate = '';
    try {
      expect(createEmptyPatient('R1').firstSeenDate).toBeUndefined();
    } finally {
      if (previousFirstSeenDate === undefined) {
        delete template.firstSeenDate;
      } else {
        template.firstSeenDate = previousFirstSeenDate;
      }
    }
  });
});
