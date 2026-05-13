import { describe, expect, it } from 'vitest';
import { resolveDailyRecordConflict } from '@/services/repositories/conflictResolutionMatrix';
import type { DailyRecord } from '@/types/domain/dailyRecord';

const makeRecord = (lastUpdated: string): DailyRecord =>
  ({
    date: '2026-02-18',
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    activeExtraBeds: [],
    lastUpdated,
  }) as unknown as DailyRecord;

describe('clinical movement-bed consistency policy', () => {
  it('does not resurrect a discharged patient from stale local bed data during automatic merge', () => {
    const remote = makeRecord('2026-02-18T10:00:00.000Z');
    remote.beds = {
      R1: {
        bedId: 'R1',
        patientName: '',
        rut: '',
        pathology: '',
        admissionDate: '',
        status: 'EMPTY',
      } as unknown as DailyRecord['beds'][string],
    };
    remote.discharges = [
      {
        id: 'discharge-1',
        bedId: 'R1',
        patientName: 'Paciente Egresado',
        rut: '33.333.333-3',
        admissionDate: '2026-02-10',
        status: 'Vivo',
        movementDate: '2026-02-18',
      },
    ] as unknown as DailyRecord['discharges'];

    const local = makeRecord('2026-02-18T10:05:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Paciente Egresado',
        rut: '33.333.333-3',
        pathology: 'Diagnostico cache antiguo',
        admissionDate: '2026-02-10',
        status: 'Vivo',
      } as unknown as DailyRecord['beds'][string],
    };

    const resolved = resolveDailyRecordConflict(remote, local);

    expect(resolved.discharges).toHaveLength(1);
    expect(resolved.beds.R1.patientName).toBe('');
    expect(resolved.beds.R1.rut).toBe('');
    expect(resolved.beds.R1.status).not.toBe('Vivo');
  });

  it('keeps a different active patient when a prior discharge exists for the same bed', () => {
    const remote = makeRecord('2026-02-18T10:00:00.000Z');
    remote.discharges = [
      {
        id: 'discharge-1',
        bedId: 'R1',
        patientName: 'Paciente Egresado',
        rut: '33.333.333-3',
        admissionDate: '2026-02-10',
        status: 'Vivo',
        movementDate: '2026-02-18',
      },
    ] as unknown as DailyRecord['discharges'];

    const local = makeRecord('2026-02-18T10:05:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Paciente Nuevo',
        rut: '44.444.444-4',
        pathology: 'Ingreso posterior',
        admissionDate: '2026-02-18',
        status: 'Estable',
      } as unknown as DailyRecord['beds'][string],
    };

    const resolved = resolveDailyRecordConflict(remote, local);

    expect(resolved.discharges).toHaveLength(1);
    expect(resolved.beds.R1.patientName).toBe('Paciente Nuevo');
    expect(resolved.beds.R1.rut).toBe('44.444.444-4');
  });

  it('does not resurrect a CMA patient from stale local bed data during automatic merge', () => {
    const remote = makeRecord('2026-02-18T10:00:00.000Z');
    remote.beds = {
      R1: {
        bedId: 'R1',
        patientName: '',
        rut: '',
        pathology: '',
        admissionDate: '',
        status: 'EMPTY',
      } as unknown as DailyRecord['beds'][string],
    };
    remote.cma = [
      {
        id: 'cma-1',
        originalBedId: 'R1',
        bedName: 'R1',
        patientName: 'Paciente CMA',
        rut: '55.555.555-5',
        diagnosis: 'Procedimiento CMA',
        specialty: 'Cirugia',
        interventionType: 'Cirugía Mayor Ambulatoria',
      },
    ] as unknown as DailyRecord['cma'];

    const local = makeRecord('2026-02-18T10:05:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Paciente CMA',
        rut: '55.555.555-5',
        pathology: 'Procedimiento CMA',
        admissionDate: '',
        status: 'Vivo',
      } as unknown as DailyRecord['beds'][string],
    };

    const resolved = resolveDailyRecordConflict(remote, local);

    expect(resolved.cma).toHaveLength(1);
    expect(resolved.beds.R1.patientName).toBe('');
    expect(resolved.beds.R1.rut).toBe('');
    expect(resolved.beds.R1.status).not.toBe('Vivo');
  });

  it('does not clear a name-only CMA match when admission evidence is missing', () => {
    const remote = makeRecord('2026-02-18T10:00:00.000Z');
    remote.cma = [
      {
        id: 'cma-name-only',
        originalBedId: 'R1',
        bedName: 'R1',
        patientName: 'Paciente Sin Rut',
        rut: '',
        diagnosis: 'Procedimiento CMA',
        specialty: 'Cirugia',
        interventionType: 'Cirugía Mayor Ambulatoria',
      },
    ] as unknown as DailyRecord['cma'];

    const local = makeRecord('2026-02-18T10:05:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Paciente Sin Rut',
        rut: '',
        pathology: 'Ingreso posterior sin RUT',
        admissionDate: '2026-02-18',
        status: 'Estable',
      } as unknown as DailyRecord['beds'][string],
    };

    const resolved = resolveDailyRecordConflict(remote, local);

    expect(resolved.cma).toHaveLength(1);
    expect(resolved.beds.R1.patientName).toBe('Paciente Sin Rut');
    expect(resolved.beds.R1.pathology).toBe('Ingreso posterior sin RUT');
  });

  it('clears a name-only CMA match when original admission date confirms the same episode', () => {
    const remote = makeRecord('2026-02-18T10:00:00.000Z');
    remote.cma = [
      {
        id: 'cma-name-and-admission',
        originalBedId: 'R1',
        bedName: 'R1',
        patientName: 'Paciente Sin Rut',
        rut: '',
        diagnosis: 'Procedimiento CMA',
        specialty: 'Cirugia',
        interventionType: 'Cirugía Mayor Ambulatoria',
        originalData: {
          admissionDate: '2026-02-10',
        },
      },
    ] as unknown as DailyRecord['cma'];

    const local = makeRecord('2026-02-18T10:05:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Paciente Sin Rut',
        rut: '',
        pathology: 'Procedimiento CMA',
        admissionDate: '2026-02-10',
        status: 'Vivo',
      } as unknown as DailyRecord['beds'][string],
    };

    const resolved = resolveDailyRecordConflict(remote, local);

    expect(resolved.cma).toHaveLength(1);
    expect(resolved.beds.R1.patientName).toBe('');
    expect(resolved.beds.R1.status).not.toBe('Vivo');
  });
});
