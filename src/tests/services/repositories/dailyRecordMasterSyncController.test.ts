import { describe, expect, it } from 'vitest';
import {
  buildAdmissionPatientMasterPatch,
  buildDischargePatientMasterPatch,
  buildEgresoRealtimeEvent,
  buildIngresoRealtimeEvent,
  buildPatientMasterSeed,
  buildTrasladoRealtimeEvent,
} from '@/services/repositories/dailyRecordMasterSyncController';

describe('dailyRecordMasterSyncController', () => {
  it('builds normalized patient master seed', () => {
    expect(
      buildPatientMasterSeed({
        rut: '1-9',
        fullName: 'Paciente',
        birthDate: null,
        forecast: 'FONASA',
        gender: null,
      })
    ).toEqual({
      rut: '1-9',
      fullName: 'Paciente',
      birthDate: undefined,
      forecast: 'FONASA',
      gender: undefined,
    });
  });

  it('builds realtime hospitalization events with fallback diagnosis', () => {
    expect(
      buildIngresoRealtimeEvent({ date: '2026-04-14', diagnosis: null, bedName: 'R1' })
    ).toEqual({
      id: '2026-04-14-ingreso-rt',
      type: 'Ingreso',
      date: '2026-04-14',
      diagnosis: 'S/D',
      bedName: 'R1',
    });

    expect(
      buildEgresoRealtimeEvent({ date: '2026-04-14', diagnosis: 'Dx', bedName: 'R2' })
    ).toEqual({
      id: '2026-04-14-egreso-rt',
      type: 'Egreso',
      date: '2026-04-14',
      diagnosis: 'Dx',
      bedName: 'R2',
    });

    expect(
      buildTrasladoRealtimeEvent({
        date: '2026-04-14',
        diagnosis: 'Dx',
        bedName: 'R3',
        receivingCenter: 'Base',
      })
    ).toEqual({
      id: '2026-04-14-traslado-rt',
      type: 'Traslado',
      date: '2026-04-14',
      diagnosis: 'Dx',
      bedName: 'R3',
      receivingCenter: 'Base',
    });
  });

  it('builds master patches for admission and discharge state', () => {
    expect(buildAdmissionPatientMasterPatch('2026-04-14')).toEqual({
      lastAdmission: '2026-04-14',
    });
    expect(buildAdmissionPatientMasterPatch(null)).toEqual({});
    expect(buildDischargePatientMasterPatch({ date: '2026-04-14', status: 'Fallecido' })).toEqual({
      lastDischarge: '2026-04-14',
      vitalStatus: 'Fallecido',
    });
  });
});
