import { describe, expect, it } from 'vitest';

import { bedManagementReducer } from '@/hooks/useBedManagementReducer';
import { DataFactory } from '@/tests/factories/DataFactory';
import { Specialty } from '@/types/domain/patientClassification';
import { BedType } from '@/types/domain/beds';

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

  it('re-anchors firstSeenDate when a stale cleared bed receives a new patient identity', () => {
    const record = DataFactory.createMockDailyRecord('2026-05-08');
    record.beds.R2 = DataFactory.createMockPatient('R2', {
      patientName: '',
      rut: '',
      admissionDate: '',
      firstSeenDate: '2026-05-03',
    });

    const patch = bedManagementReducer(record, {
      type: 'UPDATE_PATIENT_MULTIPLE',
      bedId: 'R2',
      fields: {
        patientName: 'Paciente Nuevo',
        rut: '22.222.222-2',
        admissionDate: '2026-05-08',
      },
    });

    expect(patch).toMatchObject({
      'beds.R2.patientName': 'Paciente Nuevo',
      'beds.R2.rut': '22.222.222-2',
      'beds.R2.firstSeenDate': '2026-05-08',
    });
  });

  it('clears clinical handoff data when identity changes through a single-field update', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12');
    record.beds.R1 = DataFactory.createMockPatient('R1', {
      patientName: 'Paciente Inicial',
      rut: '11.111.111-1',
      pathology: 'Neumonia',
      handoffNoteDayShift: 'Entregado',
      medicalHandoffNote: 'Nota medica',
    });

    const patch = bedManagementReducer(record, {
      type: 'UPDATE_PATIENT',
      bedId: 'R1',
      field: 'patientName',
      value: 'Paciente Corregido',
    });

    expect(patch).toMatchObject({
      'beds.R1.patientName': 'Paciente Corregido',
      'beds.R1.pathology': '',
      'beds.R1.handoffNoteDayShift': '',
      'beds.R1.medicalHandoffNote': '',
    });
  });

  it('clears gineco-obstetric fields on multi-field specialty updates away from ginecobstetricia', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12');
    record.beds.R1 = DataFactory.createMockPatient('R1', {
      specialty: Specialty.GINECOBSTETRICIA,
      ginecobstetriciaType: 'Obstétrica',
      deliveryRoute: 'Cesárea',
      deliveryCesareanLabor: 'Con TdP',
    });

    const patch = bedManagementReducer(record, {
      type: 'UPDATE_PATIENT_MULTIPLE',
      bedId: 'R1',
      fields: {
        specialty: Specialty.CIRUGIA,
      },
    });

    expect(patch).toMatchObject({
      'beds.R1.specialty': Specialty.CIRUGIA,
      'beds.R1.ginecobstetriciaType': undefined,
      'beds.R1.deliveryRoute': undefined,
      'beds.R1.deliveryCesareanLabor': undefined,
    });
  });

  it('normalizes UPC and target location when moving a patient to a non-UPC bed', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12');
    record.beds.R1 = DataFactory.createMockPatient('R1', {
      patientName: 'Paciente UPC',
      rut: '11.111.111-1',
      firstSeenDate: '2026-04-10',
      isUPC: true,
    });

    const patch = bedManagementReducer(record, {
      type: 'MOVE_PATIENT',
      sourceBedId: 'R1',
      targetBedId: 'H1C1',
    });

    expect(patch).toMatchObject({
      'beds.H1C1': expect.objectContaining({
        patientName: 'Paciente UPC',
        bedId: 'H1C1',
        location: record.beds.H1C1.location,
        isUPC: false,
      }),
      'beds.R1': expect.objectContaining({
        bedId: 'R1',
        location: record.beds.R1.location,
        firstSeenDate: undefined,
      }),
    });
  });

  it('clears the episode anchor when manually clearing one bed', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12');
    record.beds.R1 = DataFactory.createMockPatient('R1', {
      patientName: 'Paciente Inicial',
      rut: '11.111.111-1',
      firstSeenDate: '2026-04-10',
      location: 'Box 1',
    });

    const patch = bedManagementReducer(record, {
      type: 'CLEAR_PATIENT',
      bedId: 'R1',
    });

    expect(patch).toMatchObject({
      'beds.R1': expect.objectContaining({
        bedId: 'R1',
        patientName: '',
        rut: '',
        firstSeenDate: undefined,
        admissionDate: '',
        location: 'Box 1',
      }),
    });
  });

  it('normalizes UPC and target location when copying a patient to a non-UPC bed', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12');
    record.beds.R1 = DataFactory.createMockPatient('R1', {
      patientName: 'Paciente UPC',
      rut: '11.111.111-1',
      isUPC: true,
    });

    const patch = bedManagementReducer(record, {
      type: 'COPY_PATIENT',
      sourceBedId: 'R1',
      targetBedId: 'H1C1',
    });

    expect(patch).toMatchObject({
      'beds.H1C1': expect.objectContaining({
        patientName: 'Paciente UPC',
        bedId: 'H1C1',
        location: record.beds.H1C1.location,
        isUPC: false,
      }),
    });
  });

  it('clears every bed while preserving each original location', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12');
    record.beds.R1 = DataFactory.createMockPatient('R1', {
      patientName: 'Paciente 1',
      location: 'Box 1',
    });
    record.beds.H1C1 = DataFactory.createMockPatient('H1C1', {
      patientName: 'Paciente 2',
      location: 'Habitacion 1',
    });

    const patch = bedManagementReducer(record, {
      type: 'CLEAR_ALL_BEDS',
    });

    expect(patch).toMatchObject({
      'beds.R1': expect.objectContaining({
        bedId: 'R1',
        patientName: '',
        location: 'Box 1',
        firstSeenDate: undefined,
      }),
      'beds.H1C1': expect.objectContaining({
        bedId: 'H1C1',
        patientName: '',
        location: 'Habitacion 1',
        firstSeenDate: undefined,
      }),
    });
  });

  it('creates a provisional clinical crib using the mother label fallback', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12');
    record.beds.R1 = DataFactory.createMockPatient('R1', {
      firstName: 'Ana',
      lastName: 'Perez',
      secondLastName: 'Soto',
      patientName: 'Ana Perez Soto',
    });

    const patch = bedManagementReducer(record, {
      type: 'CREATE_CLINICAL_CRIB',
      bedId: 'R1',
    });

    expect(patch).toMatchObject({
      'beds.R1.clinicalCrib': expect.objectContaining({
        bedMode: 'Cuna',
        identityStatus: 'provisional',
        patientName: 'RN de Ana Perez Soto',
        documentType: 'RUT',
      }),
      'beds.R1.hasCompanionCrib': false,
    });
  });

  it('toggles blocked bed state preserving the provided reason only while blocked', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12');

    const blockedPatch = bedManagementReducer(record, {
      type: 'TOGGLE_BLOCK_BED',
      bedId: 'R1',
      reason: 'Aislamiento',
    });

    expect(blockedPatch).toMatchObject({
      'beds.R1.isBlocked': true,
      'beds.R1.blockedReason': 'Aislamiento',
    });
  });

  it('toggles active extra beds without duplicating existing entries', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12');
    record.activeExtraBeds = ['R1'];

    const patch = bedManagementReducer(record, {
      type: 'TOGGLE_EXTRA_BED',
      bedId: 'R2',
    });

    expect(patch).toMatchObject({
      activeExtraBeds: ['R1', 'R2'],
    });
  });

  it('toggles bed type overrides between UTI and UCI', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12');

    const patch = bedManagementReducer(record, {
      type: 'TOGGLE_BED_TYPE',
      bedId: 'R1',
    });

    expect(patch).toHaveProperty('bedTypeOverrides.R1');
  });

  it('forces the bed type to UCI when the patient is classified as UPC_UCI', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12');

    const patch = bedManagementReducer(record, {
      type: 'UPDATE_PATIENT_MULTIPLE',
      bedId: 'R1',
      fields: {
        isUPC: true,
        upcChecklist: {
          uciCriteria: ['uci_vmi'],
          utiCriteria: ['uti_mon_cardiaca'],
          classification: 'UPC_UCI',
          evaluatedAt: '2026-04-18T00:00:00Z',
        },
      },
    });

    expect(patch).toMatchObject({
      'beds.R1.isUPC': true,
      'beds.R1.upcChecklist': expect.objectContaining({
        classification: 'UPC_UCI',
      }),
      'bedTypeOverrides.R1': BedType.UCI,
    });
  });

  it('returns the bed type override to default UTI when UCI criteria are removed', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12');
    record.bedTypeOverrides = { R1: BedType.UCI };
    record.beds.R1 = DataFactory.createMockPatient('R1', {
      isUPC: true,
      upcChecklist: {
        uciCriteria: ['uci_vmi'],
        utiCriteria: ['uti_mon_cardiaca'],
        classification: 'UPC_UCI',
        evaluatedAt: '2026-04-18T00:00:00Z',
      },
    });

    const patch = bedManagementReducer(record, {
      type: 'UPDATE_PATIENT_MULTIPLE',
      bedId: 'R1',
      fields: {
        isUPC: true,
        upcChecklist: {
          uciCriteria: [],
          utiCriteria: ['uti_mon_cardiaca'],
          classification: 'UPC_UTI',
          evaluatedAt: '2026-04-18T00:05:00Z',
        },
      },
    });

    expect(patch).toMatchObject({
      'beds.R1.upcChecklist': expect.objectContaining({
        classification: 'UPC_UTI',
      }),
      'bedTypeOverrides.R1': undefined,
    });
  });

  it('updates multiple clinical crib fields in a single patch', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12');

    const patch = bedManagementReducer(record, {
      type: 'UPDATE_CLINICAL_CRIB_MULTIPLE',
      bedId: 'R1',
      fields: {
        patientName: 'RN Temporal',
        pathology: 'Observación',
      },
    });

    expect(patch).toEqual({
      'beds.R1.clinicalCrib.patientName': 'RN Temporal',
      'beds.R1.clinicalCrib.pathology': 'Observación',
    });
  });

  it('updates blocked reason and single clinical crib fields through dedicated patches', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12');

    const blockedReasonPatch = bedManagementReducer(record, {
      type: 'UPDATE_BLOCKED_REASON',
      bedId: 'R1',
      reason: 'Mantenimiento',
    });
    const cribFieldPatch = bedManagementReducer(record, {
      type: 'UPDATE_CLINICAL_CRIB',
      bedId: 'R1',
      field: 'patientName',
      value: 'RN Ajustado',
    });

    expect(blockedReasonPatch).toEqual({
      'beds.R1.blockedReason': 'Mantenimiento',
    });
    expect(cribFieldPatch).toEqual({
      'beds.R1.clinicalCrib.patientName': 'RN Ajustado',
    });
  });

  it('ignores clinical crib CUDYR updates when the crib has not been created yet', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12');

    const patch = bedManagementReducer(record, {
      type: 'UPDATE_CLINICAL_CRIB_CUDYR',
      bedId: 'R1',
      field: 'changeClothes',
      value: 2,
    });

    expect(patch).toBeNull();
  });

  it('updates clinical crib CUDYR fields while refreshing the shared timestamp', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12');
    record.beds.R1 = DataFactory.createMockPatient('R1', {
      clinicalCrib: DataFactory.createMockPatient('R1-crib', {
        patientName: 'RN Temporal',
      }),
    });

    const patch = bedManagementReducer(record, {
      type: 'UPDATE_CLINICAL_CRIB_CUDYR',
      bedId: 'R1',
      field: 'changeClothes',
      value: 2,
    });

    expect(patch).toMatchObject({
      'beds.R1.clinicalCrib.cudyr.changeClothes': 2,
    });
    expect(patch).toHaveProperty('cudyrUpdatedAt');
  });

  it('toggles extra beds by adding and removing the same bed id predictably', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12');
    record.activeExtraBeds = ['H1C1'];

    const removePatch = bedManagementReducer(record, {
      type: 'TOGGLE_EXTRA_BED',
      bedId: 'H1C1',
    });

    const addPatch = bedManagementReducer(record, {
      type: 'TOGGLE_EXTRA_BED',
      bedId: 'H2C1',
    });

    expect(removePatch).toEqual({ activeExtraBeds: [] });
    expect(addPatch).toEqual({ activeExtraBeds: ['H1C1', 'H2C1'] });
  });
});
