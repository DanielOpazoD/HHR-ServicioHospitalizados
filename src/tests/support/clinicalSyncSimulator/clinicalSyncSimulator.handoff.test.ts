import { describe, expect, it } from 'vitest';

import { createClinicalSyncSimulator } from './clinicalSyncSimulator';
import type { DailyRecord } from '@/types/domain/dailyRecord';

const actor = {
  uid: 'doctor-1',
  displayName: 'Dr. Test',
  email: 'doctor@hospital.cl',
};

const makeRecord = (): DailyRecord =>
  ({
    date: '2026-07-03',
    beds: {
      R1: {
        bedId: 'R1',
        patientName: 'Paciente Handoff',
        rut: '11.111.111-1',
        age: '40a',
        pathology: 'Diagnostico base',
        specialty: 'Medicina',
        status: 'Estable',
        admissionDate: '2026-07-01',
        clinicalEpisodeId: 'episode-handoff-1',
        devices: [],
        handoffNoteDayShift: '',
        handoffNoteNightShift: '',
        medicalHandoffEntries: [],
      },
    },
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated: '2026-07-03T08:00:00.000Z',
    nurses: [],
    activeExtraBeds: [],
    handoffNovedadesDayShift: '',
    handoffNovedadesNightShift: '',
    medicalHandoffBySpecialty: {},
    medicalHandoffNovedades: '',
  }) as unknown as DailyRecord;

describe('clinicalSyncSimulator handoff scenarios', () => {
  it('preserves compatible nursing handoff notes and novedades across stale restart replay', () => {
    const simulator = createClinicalSyncSimulator({
      initialRecord: makeRecord(),
      clients: ['day-shift-pc', 'night-shift-pc'],
    });

    simulator.mutate(
      'day-shift-pc',
      {
        changedPaths: ['beds.R1.handoffNoteDayShift', 'handoffNovedadesDayShift'],
        module: 'entrega_enfermeria',
        label: 'entrega dia',
      },
      record => {
        record.beds.R1.handoffNoteDayShift = 'Nota visible de turno largo';
        record.handoffNovedadesDayShift = 'Novedad global turno largo';
      }
    );
    expect(simulator.replayNext('day-shift-pc').status).toBe('accepted');

    simulator.mutate(
      'night-shift-pc',
      {
        changedPaths: ['beds.R1.handoffNoteNightShift', 'handoffNovedadesNightShift'],
        module: 'entrega_enfermeria',
        label: 'entrega noche stale',
      },
      record => {
        record.beds.R1.handoffNoteNightShift = 'Nota visible de turno noche';
        record.handoffNovedadesNightShift = 'Novedad global turno noche';
      }
    );

    const restarted = simulator.restartClient('night-shift-pc');
    expect(restarted.outbox).toHaveLength(1);

    const replay = simulator.replayNext('night-shift-pc');

    expect(replay.status).toBe('auto_merged');
    expect(simulator.getRemote().beds.R1.handoffNoteDayShift).toBe('Nota visible de turno largo');
    expect(simulator.getRemote().beds.R1.handoffNoteNightShift).toBe('Nota visible de turno noche');
    expect(simulator.getRemote().handoffNovedadesDayShift).toBe('Novedad global turno largo');
    expect(simulator.getRemote().handoffNovedadesNightShift).toBe('Novedad global turno noche');
    expect(simulator.getAuditEvents().at(-1)).toMatchObject({
      action: 'auto_merged',
      module: 'entrega_enfermeria',
      changedPaths: ['beds.R1.handoffNoteNightShift', 'handoffNovedadesNightShift'],
    });
  });

  it('merges parallel medical specialty notes and keeps derived novedades consistent', () => {
    const simulator = createClinicalSyncSimulator({
      initialRecord: makeRecord(),
      clients: ['cirugia-pc', 'trauma-pc'],
    });

    simulator.mutate(
      'cirugia-pc',
      {
        changedPaths: ['medicalHandoffBySpecialty.cirugia'],
        module: 'entrega_medica',
        label: 'nota cirugia',
      },
      record => {
        record.medicalHandoffBySpecialty = {
          ...record.medicalHandoffBySpecialty,
          cirugia: {
            note: 'Pendiente pabellon',
            createdAt: '2026-07-03T09:00:00.000Z',
            updatedAt: '2026-07-03T09:00:00.000Z',
            author: actor,
            version: 1,
          },
        };
      }
    );
    expect(simulator.replayNext('cirugia-pc').status).toBe('accepted');

    simulator.mutate(
      'trauma-pc',
      {
        changedPaths: ['medicalHandoffBySpecialty.traumatologia'],
        module: 'entrega_medica',
        label: 'nota traumatologia stale',
      },
      record => {
        record.medicalHandoffBySpecialty = {
          ...record.medicalHandoffBySpecialty,
          traumatologia: {
            note: 'Control radiografia',
            createdAt: '2026-07-03T09:05:00.000Z',
            updatedAt: '2026-07-03T09:05:00.000Z',
            author: actor,
            version: 1,
          },
        };
      }
    );

    const replay = simulator.replayNext('trauma-pc');

    expect(replay.status).toBe('auto_merged');
    expect(simulator.getRemote().medicalHandoffBySpecialty?.cirugia?.note).toBe(
      'Pendiente pabellon'
    );
    expect(simulator.getRemote().medicalHandoffBySpecialty?.traumatologia?.note).toBe(
      'Control radiografia'
    );
    expect(simulator.getRemote().medicalHandoffNovedades).toContain('Pendiente pabellon');
    expect(simulator.getRemote().medicalHandoffNovedades).toContain('Control radiografia');
  });

  it('preserves concurrent medical handoff entries by id and ignores stale entries from another episode', () => {
    const simulator = createClinicalSyncSimulator({
      initialRecord: makeRecord(),
      clients: ['medicine-pc', 'surgery-pc', 'stale-other-episode-pc'],
    });

    simulator.mutate(
      'medicine-pc',
      {
        changedPaths: ['beds.R1.medicalHandoffEntries'],
        module: 'entrega_medica',
        label: 'entry medicina',
      },
      record => {
        record.beds.R1.medicalHandoffEntries = [
          {
            id: 'entry-medicina',
            specialty: 'Medicina',
            note: 'Continuar antibioticos',
          },
        ];
      }
    );
    expect(simulator.replayNext('medicine-pc').status).toBe('accepted');

    simulator.mutate(
      'surgery-pc',
      {
        changedPaths: ['beds.R1.medicalHandoffEntries'],
        module: 'entrega_medica',
        label: 'entry cirugia stale mismo episodio',
      },
      record => {
        record.beds.R1.medicalHandoffEntries = [
          {
            id: 'entry-cirugia',
            specialty: 'Cirugia',
            note: 'Evaluar herida quirurgica',
          },
        ];
      }
    );
    expect(simulator.replayNext('surgery-pc').status).toBe('auto_merged');
    expect(simulator.getRemote().beds.R1.medicalHandoffEntries).toEqual([
      expect.objectContaining({ id: 'entry-medicina' }),
      expect.objectContaining({ id: 'entry-cirugia' }),
    ]);

    simulator.mutate(
      'stale-other-episode-pc',
      {
        changedPaths: ['beds.R1.medicalHandoffEntries'],
        module: 'entrega_medica',
        label: 'entry stale otro episodio',
      },
      record => {
        record.beds.R1 = {
          ...record.beds.R1,
          patientName: 'Paciente Antiguo',
          rut: '22.222.222-2',
          clinicalEpisodeId: 'episode-old',
          medicalHandoffEntries: [
            {
              id: 'entry-old',
              specialty: 'Cirugia',
              note: 'No debe revivir en otro episodio',
            },
          ],
        };
      }
    );

    const replay = simulator.replayNext('stale-other-episode-pc');

    expect(replay.status).toBe('auto_merged');
    expect(simulator.getRemote().beds.R1.medicalHandoffEntries).toEqual([
      expect.objectContaining({ id: 'entry-medicina' }),
      expect.objectContaining({ id: 'entry-cirugia' }),
    ]);
    expect(
      simulator.getRemote().beds.R1.medicalHandoffEntries?.some(entry => entry.id === 'entry-old')
    ).toBe(false);
  });
});
