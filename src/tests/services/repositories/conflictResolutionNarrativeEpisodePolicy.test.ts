import { describe, expect, it } from 'vitest';
import { resolveDailyRecordConflict } from '@/services/repositories/conflictResolutionMatrix';
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

describe('conflict resolution narrative episode policy', () => {
  it('does not carry local handoff narrative into a different remote patient episode', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    remote.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Paciente Nuevo',
        rut: '22.222.222-2',
        admissionDate: '2026-02-18',
        handoffNoteDayShift: '',
        handoffNoteNightShift: '',
        medicalHandoffNote: '',
      } as unknown as DailyRecord['beds'][string],
    };

    const local = makeRecord('2026-02-18', '2026-02-18T10:05:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Paciente Antiguo',
        rut: '11.111.111-1',
        admissionDate: '2026-02-10',
        handoffNoteDayShift: 'Evolucion del paciente antiguo',
        handoffNoteNightShift: 'Noche del paciente antiguo',
        medicalHandoffNote: 'Nota medica del paciente antiguo',
      } as unknown as DailyRecord['beds'][string],
    };

    const resolved = resolveDailyRecordConflict(remote, local);

    expect(resolved.beds.R1.patientName).toBe('Paciente Nuevo');
    expect(resolved.beds.R1.rut).toBe('22.222.222-2');
    expect(resolved.beds.R1.handoffNoteDayShift).toBe('');
    expect(resolved.beds.R1.handoffNoteNightShift).toBe('');
    expect(resolved.beds.R1.medicalHandoffNote).toBe('');
  });

  it('does not apply a stale changed-path handoff note to a different remote patient episode', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    remote.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Paciente Nuevo',
        rut: '22.222.222-2',
        admissionDate: '2026-02-18',
        handoffNoteDayShift: '',
      } as unknown as DailyRecord['beds'][string],
    };

    const local = makeRecord('2026-02-18', '2026-02-18T10:05:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Paciente Antiguo',
        rut: '11.111.111-1',
        admissionDate: '2026-02-10',
        handoffNoteDayShift: 'Evolucion stale desde outbox local',
      } as unknown as DailyRecord['beds'][string],
    };

    const resolved = resolveDailyRecordConflict(remote, local, {
      changedPaths: ['beds.R1.handoffNoteDayShift'],
    });

    expect(resolved.beds.R1.patientName).toBe('Paciente Nuevo');
    expect(resolved.beds.R1.handoffNoteDayShift).toBe('');
  });

  it('does not carry local handoff narrative when admission anchors differ without rut', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    remote.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Paciente Nuevo',
        rut: '',
        admissionDate: '2026-02-18',
        handoffNoteDayShift: '',
      } as unknown as DailyRecord['beds'][string],
    };

    const local = makeRecord('2026-02-18', '2026-02-18T10:05:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Paciente Antiguo',
        rut: '',
        admissionDate: '2026-02-10',
        handoffNoteDayShift: 'Evolucion del paciente anterior sin RUT',
      } as unknown as DailyRecord['beds'][string],
    };

    const resolved = resolveDailyRecordConflict(remote, local);

    expect(resolved.beds.R1.patientName).toBe('Paciente Nuevo');
    expect(resolved.beds.R1.handoffNoteDayShift).toBe('');
  });

  it('does not carry local structured narrative entries into a different remote patient episode', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    remote.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Paciente Nuevo',
        rut: '22.222.222-2',
        admissionDate: '2026-02-18',
        clinicalEvents: [],
        medicalHandoffEntries: [],
      } as unknown as DailyRecord['beds'][string],
    };

    const local = makeRecord('2026-02-18', '2026-02-18T10:05:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Paciente Antiguo',
        rut: '11.111.111-1',
        admissionDate: '2026-02-10',
        clinicalEvents: [{ id: 'event-old', name: 'Evento del paciente antiguo' }],
        medicalHandoffEntries: [{ id: 'handoff-old', note: 'Evolucion del paciente antiguo' }],
      } as unknown as DailyRecord['beds'][string],
    };

    const resolved = resolveDailyRecordConflict(remote, local);

    expect(resolved.beds.R1.patientName).toBe('Paciente Nuevo');
    expect(resolved.beds.R1.clinicalEvents).toEqual([]);
    expect(resolved.beds.R1.medicalHandoffEntries).toEqual([]);
  });

  it('does not apply stale changed-path structured entries to a different remote patient episode', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    remote.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Paciente Nuevo',
        rut: '22.222.222-2',
        admissionDate: '2026-02-18',
        clinicalEvents: [],
      } as unknown as DailyRecord['beds'][string],
    };

    const local = makeRecord('2026-02-18', '2026-02-18T10:05:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Paciente Antiguo',
        rut: '11.111.111-1',
        admissionDate: '2026-02-10',
        clinicalEvents: [{ id: 'event-old', name: 'Evento stale desde outbox local' }],
      } as unknown as DailyRecord['beds'][string],
    };

    const resolved = resolveDailyRecordConflict(remote, local, {
      changedPaths: ['beds.R1.clinicalEvents'],
    });

    expect(resolved.beds.R1.patientName).toBe('Paciente Nuevo');
    expect(resolved.beds.R1.clinicalEvents).toEqual([]);
  });
});
