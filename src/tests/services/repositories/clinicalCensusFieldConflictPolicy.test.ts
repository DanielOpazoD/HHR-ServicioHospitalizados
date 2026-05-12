import { describe, expect, it } from 'vitest';
import { resolveDailyRecordConflictWithTrace } from '@/services/repositories/conflictResolutionMatrix';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import { Specialty } from '@/types/domain/patientClassification';

const makeRecord = (date: string, lastUpdated: string): DailyRecord =>
  ({
    date,
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated,
    nurses: [],
    activeExtraBeds: [],
  }) as unknown as DailyRecord;

describe('clinical census field conflict policy', () => {
  it('prioritizes Firebase census fields over stale local diagnosis and specialty', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    remote.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Paciente Censo',
        rut: '11.111.111-1',
        pathology: 'Neumonia adquirida en la comunidad',
        diagnosisComments: 'CURB-65 elevado',
        specialty: Specialty.MEDICINA,
        secondarySpecialty: Specialty.CIRUGIA,
        status: 'Estable',
        handoffNote: 'Nota localizable no censal remota',
      } as unknown as DailyRecord['beds'][string],
    };

    const local = makeRecord('2026-02-18', '2026-02-18T09:55:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Paciente Censo',
        rut: '11.111.111-1',
        pathology: 'Diagnostico cache antiguo',
        diagnosisComments: 'Comentario cache antiguo',
        specialty: Specialty.PEDIATRIA,
        secondarySpecialty: '',
        status: 'Grave',
        handoffNote: 'Nota local de turno debe preservarse',
      } as unknown as DailyRecord['beds'][string],
    };

    const result = resolveDailyRecordConflictWithTrace(remote, local, { changedPaths: ['*'] });

    expect(result.record.beds.R1.pathology).toBe('Neumonia adquirida en la comunidad');
    expect(result.record.beds.R1.diagnosisComments).toBe('CURB-65 elevado');
    expect(result.record.beds.R1.specialty).toBe(Specialty.MEDICINA);
    expect(result.record.beds.R1.secondarySpecialty).toBe(Specialty.CIRUGIA);
    expect(result.record.beds.R1.status).toBe('Estable');
    expect(result.record.beds.R1.handoffNote).toBe('Nota local de turno debe preservarse');
    expect(result.trace.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'beds.R1.pathology',
          winner: 'remote',
          reason: 'clinical_census_remote_priority',
        }),
        expect.objectContaining({
          path: 'beds.R1.handoffNote',
          winner: 'local',
          reason: 'clinical_local_priority',
        }),
      ])
    );
  });
});
