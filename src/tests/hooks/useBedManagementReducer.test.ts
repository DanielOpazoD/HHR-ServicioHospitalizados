import { describe, expect, it } from 'vitest';

import { bedManagementReducer } from '@/hooks/useBedManagementReducer';
import { DataFactory } from '@/tests/factories/DataFactory';

describe('bedManagementReducer firstSeenDate anchoring', () => {
  it('anchors firstSeenDate when an empty bed receives its first real patient name', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-11');

    const patch = bedManagementReducer(record, {
      type: 'UPDATE_PATIENT',
      bedId: 'R1',
      field: 'patientName',
      value: 'Paciente Demo',
    });

    expect(patch).toMatchObject({
      'beds.R1.patientName': 'Paciente Demo',
      'beds.R1.firstSeenDate': '2026-04-11',
    });
  });

  it('does not anchor firstSeenDate for the temporary blank placeholder name', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-11');

    const patch = bedManagementReducer(record, {
      type: 'UPDATE_PATIENT',
      bedId: 'R1',
      field: 'patientName',
      value: ' ',
    });

    expect(patch).toMatchObject({
      'beds.R1.patientName': ' ',
    });
    expect(patch).not.toHaveProperty('beds.R1.firstSeenDate');
  });

  it('anchors firstSeenDate on multi-field updates when identity appears for the first time', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-11');

    const patch = bedManagementReducer(record, {
      type: 'UPDATE_PATIENT_MULTIPLE',
      bedId: 'R1',
      fields: {
        patientName: 'Paciente Demo',
        rut: '11.111.111-1',
      },
    });

    expect(patch).toMatchObject({
      'beds.R1.patientName': 'Paciente Demo',
      'beds.R1.rut': '11.111.111-1',
      'beds.R1.firstSeenDate': '2026-04-11',
    });
  });

  it('keeps an existing firstSeenDate when later edits update the identity', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12');
    record.beds.R1 = DataFactory.createMockPatient('R1', {
      patientName: 'Paciente Inicial',
      rut: '11.111.111-1',
      firstSeenDate: '2026-04-11',
    });

    const patch = bedManagementReducer(record, {
      type: 'UPDATE_PATIENT',
      bedId: 'R1',
      field: 'patientName',
      value: 'Paciente Corregido',
    });

    expect(patch).toMatchObject({
      'beds.R1.patientName': 'Paciente Corregido',
    });
    expect(patch).not.toHaveProperty('beds.R1.firstSeenDate');
  });
});
