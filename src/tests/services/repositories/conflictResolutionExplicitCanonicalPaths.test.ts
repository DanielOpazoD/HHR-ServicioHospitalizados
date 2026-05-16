import { describe, expect, it } from 'vitest';
import {
  resolveDailyRecordConflict,
  resolveDailyRecordConflictWithTrace,
} from '@/services/repositories/conflictResolutionMatrix';
import type { DailyRecord } from '@/types/domain/dailyRecord';

const makeRecord = (date: string, lastUpdated: string): DailyRecord => ({
  date,
  beds: {},
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated,
  nurses: [],
  activeExtraBeds: [],
});

describe('conflictResolution explicit canonical paths', () => {
  it('does not let stale explicit local paths overwrite newer remote canonical census fields', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:05:00.000Z');
    remote.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Nombre remoto vigente',
        pathology: 'Diagnostico remoto vigente',
      } as unknown as DailyRecord['beds'][string],
    };

    const local = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Nombre local stale',
        pathology: 'Diagnostico local stale',
      } as unknown as DailyRecord['beds'][string],
    };

    const resolved = resolveDailyRecordConflict(remote, local, {
      changedPaths: ['beds.R1.patientName', 'beds.R1.pathology'],
    });

    expect(resolved.beds.R1.patientName).toBe('Nombre remoto vigente');
    expect(resolved.beds.R1.pathology).toBe('Diagnostico remoto vigente');
  });

  it('keeps explicit local specialty and status edits for the same active episode', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:05:00.000Z');
    remote.beds = {
      R1: {
        bedId: 'R1',
        clinicalEpisodeId: 'episode-r1',
        patientName: 'Paciente vigente',
        rut: '11.111.111-1',
        admissionDate: '2026-02-17',
        specialty: 'Medicina',
        secondarySpecialty: undefined,
        status: 'Estable',
        pathology: 'Diagnostico remoto vigente',
      } as unknown as DailyRecord['beds'][string],
    };

    const local = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        clinicalEpisodeId: 'episode-r1',
        patientName: 'Paciente vigente',
        rut: '11.111.111-1',
        admissionDate: '2026-02-17',
        specialty: 'Otra especialidad',
        secondarySpecialty: 'Infectologia',
        status: 'De cuidado',
        pathology: 'Diagnostico local stale',
      } as unknown as DailyRecord['beds'][string],
    };

    const result = resolveDailyRecordConflictWithTrace(remote, local, {
      changedPaths: ['beds.R1.specialty', 'beds.R1.secondarySpecialty', 'beds.R1.status'],
    });

    const resolved = result.record;
    expect(resolved.beds.R1.specialty).toBe('Otra especialidad');
    expect(resolved.beds.R1.secondarySpecialty).toBe('Infectologia');
    expect(resolved.beds.R1.status).toBe('De cuidado');
    expect(resolved.beds.R1.pathology).toBe('Diagnostico remoto vigente');
    expect(result.trace.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'beds.R1.specialty',
          winner: 'local',
          reason: 'explicit_local_census_patch_same_episode',
        }),
      ])
    );
  });

  it('keeps explicit status edits when the remote snapshot already has a generated episode id', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:05:00.000Z');
    remote.beds = {
      R1: {
        bedId: 'R1',
        clinicalEpisodeId: 'ep_r1_generated',
        patientName: 'Paciente vigente',
        rut: '11.111.111-1',
        admissionDate: '2026-02-18',
        admissionTime: '08:00',
        status: '',
      } as unknown as DailyRecord['beds'][string],
    };

    const local = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        clinicalEpisodeId: undefined,
        patientName: 'Paciente vigente',
        rut: '11.111.111-1',
        admissionDate: '2026-02-18',
        admissionTime: '08:00',
        status: 'Grave',
      } as unknown as DailyRecord['beds'][string],
    };

    const result = resolveDailyRecordConflictWithTrace(remote, local, {
      changedPaths: ['beds.R1.status'],
    });

    expect(result.record.beds.R1.status).toBe('Grave');
    expect(result.trace.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'beds.R1.status',
          winner: 'local',
          reason: 'explicit_local_census_patch_same_episode',
        }),
      ])
    );
  });

  it('does not keep explicit local specialty and status edits for a different episode', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:05:00.000Z');
    remote.beds = {
      R1: {
        bedId: 'R1',
        clinicalEpisodeId: 'episode-new',
        patientName: 'Paciente nuevo',
        rut: '11.111.111-1',
        admissionDate: '2026-02-18',
        admissionTime: '15:30',
        specialty: 'Medicina',
        secondarySpecialty: undefined,
        status: 'Estable',
      } as unknown as DailyRecord['beds'][string],
    };

    const local = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        clinicalEpisodeId: 'episode-old',
        patientName: 'Paciente antiguo',
        rut: '11.111.111-1',
        admissionDate: '2026-02-18',
        admissionTime: '08:00',
        specialty: 'Otra especialidad',
        secondarySpecialty: 'Infectologia',
        status: 'De cuidado',
      } as unknown as DailyRecord['beds'][string],
    };

    const resolved = resolveDailyRecordConflict(remote, local, {
      changedPaths: ['beds.R1.specialty', 'beds.R1.secondarySpecialty', 'beds.R1.status'],
    });

    expect(resolved.beds.R1.specialty).toBe('Medicina');
    expect(resolved.beds.R1.secondarySpecialty).toBeUndefined();
    expect(resolved.beds.R1.status).toBe('Estable');
  });
});
