import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import { Specialty, PatientStatus } from '@/types/domain/patientClassification';
import { syncPatientsToMasterInBackground } from '@/services/repositories/dailyRecordBackgroundMasterSyncController';
import { PatientMasterRepository } from '@/services/repositories/PatientMasterRepository';

describe('dailyRecordBackgroundMasterSyncController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('syncs bed patients, discharges, transfers, and admission backfill in the background', async () => {
    const upsertSpy = vi
      .spyOn(PatientMasterRepository, 'upsertPatient')
      .mockResolvedValue(undefined);
    const appendSpy = vi
      .spyOn(PatientMasterRepository, 'appendHospitalizationEvent')
      .mockResolvedValue(undefined);

    const record: DailyRecord = {
      date: '2026-04-14',
      beds: {
        R1: {
          bedId: 'R1',
          isBlocked: false,
          bedMode: 'Cama',
          hasCompanionCrib: false,
          patientName: 'Paciente en cama',
          rut: '1-9',
          age: '46',
          birthDate: '1980-01-01',
          insurance: 'Fonasa',
          biologicalSex: 'Femenino',
          pathology: 'Dx ingreso',
          specialty: Specialty.MEDICINA,
          status: PatientStatus.ESTABLE,
          admissionDate: '2026-04-10',
          hasWristband: true,
          devices: [],
          surgicalComplication: false,
          isUPC: false,
        } as unknown as DailyRecord['beds'][string],
      },
      discharges: [
        {
          id: 'd1',
          movementDate: '2026-04-14',
          rut: '2-7',
          patientName: 'Paciente alta',
          insurance: 'Isapre',
          diagnosis: 'Dx egreso',
          bedName: 'R2',
          bedId: 'R2',
          bedType: 'basica',
          time: '12:00',
          status: 'Fallecido',
          admissionDate: '2026-04-09',
        } as DailyRecord['discharges'][number],
      ],
      transfers: [
        {
          id: 't1',
          movementDate: '2026-04-14',
          rut: '3-5',
          patientName: 'Paciente traslado',
          diagnosis: 'Dx traslado',
          bedName: 'R3',
          bedId: 'R3',
          bedType: 'basica',
          time: '13:00',
          evacuationMethod: 'Ambulancia',
          receivingCenter: 'Hospital Base',
          admissionDate: '2026-04-08',
        } as DailyRecord['transfers'][number],
      ],
      cma: [],
      lastUpdated: '2026-04-14T12:00:00.000Z',
      nurses: [],
      nursesDayShift: [],
      nursesNightShift: [],
      tensDayShift: [],
      tensNightShift: [],
      activeExtraBeds: [],
    };

    syncPatientsToMasterInBackground(record);

    expect(upsertSpy).not.toHaveBeenCalled();
    expect(appendSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy).toHaveBeenCalledWith({
      rut: '1-9',
      fullName: 'Paciente en cama',
      birthDate: '1980-01-01',
      forecast: 'Fonasa',
      gender: 'Femenino',
    });

    expect(appendSpy).toHaveBeenCalledTimes(5);
    expect(appendSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ rut: '1-9', fullName: 'Paciente en cama' }),
      expect.objectContaining({ type: 'Ingreso', date: '2026-04-10', bedName: 'R1' }),
      { lastAdmission: '2026-04-10' }
    );
    expect(appendSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ rut: '2-7', fullName: 'Paciente alta' }),
      expect.objectContaining({ type: 'Egreso', date: '2026-04-14', bedName: 'R2' }),
      { lastDischarge: '2026-04-14', vitalStatus: 'Fallecido' }
    );
    expect(appendSpy).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ rut: '2-7', fullName: 'Paciente alta' }),
      expect.objectContaining({ type: 'Ingreso', date: '2026-04-09', bedName: 'R2' }),
      { lastAdmission: '2026-04-09' }
    );
    expect(appendSpy).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ rut: '3-5', fullName: 'Paciente traslado' }),
      expect.objectContaining({
        type: 'Traslado',
        date: '2026-04-14',
        bedName: 'R3',
        receivingCenter: 'Hospital Base',
      }),
      undefined
    );
    expect(appendSpy).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ rut: '3-5', fullName: 'Paciente traslado' }),
      expect.objectContaining({ type: 'Ingreso', date: '2026-04-08', bedName: 'R3' }),
      { lastAdmission: '2026-04-08' }
    );
  });

  it('swallows non-critical background sync failures', async () => {
    vi.spyOn(PatientMasterRepository, 'upsertPatient').mockRejectedValue(new Error('boom'));
    const appendSpy = vi.spyOn(PatientMasterRepository, 'appendHospitalizationEvent');

    const record: DailyRecord = {
      date: '2026-04-14',
      beds: {
        R1: {
          bedId: 'R1',
          isBlocked: false,
          bedMode: 'Cama',
          hasCompanionCrib: false,
          patientName: 'Paciente en cama',
          rut: '1-9',
          age: '46',
          pathology: '',
          specialty: Specialty.MEDICINA,
          status: PatientStatus.ESTABLE,
          admissionDate: '2026-04-10',
          hasWristband: true,
          devices: [],
          surgicalComplication: false,
          isUPC: false,
        } as unknown as DailyRecord['beds'][string],
      },
      discharges: [],
      transfers: [],
      cma: [],
      lastUpdated: '2026-04-14T12:00:00.000Z',
      nurses: [],
      nursesDayShift: [],
      nursesNightShift: [],
      tensDayShift: [],
      tensNightShift: [],
      activeExtraBeds: [],
    };

    expect(() => syncPatientsToMasterInBackground(record)).not.toThrow();
    await vi.advanceTimersByTimeAsync(1000);

    expect(appendSpy).not.toHaveBeenCalled();
  });
});
