import { describe, expect, it, vi } from 'vitest';
import { validateAndSalvageRecord } from '@/services/repositories/helpers/validationHelper';

describe('validationHelper', () => {
  it('salvages legacy nulls and malformed beds instead of throwing', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const record = validateAndSalvageRecord(
      {
        date: '2026-03-04',
        beds: {
          R1: {
            patientName: 'Paciente Legacy',
            status: 'ESTADO_INVALIDO',
            clinicalEvents: [
              {
                id: 'event-1',
                name: 'Cultivo',
                date: '2026-03-03',
                note: null,
                createdAt: '2026-03-03T10:00:00.000Z',
              },
            ],
          },
        },
        discharges: null,
      } as never,
      '2026-03-04'
    );

    expect(record.beds.R1.patientName).toBe('Paciente Legacy');
    expect(record.beds.R1.clinicalEvents).toEqual([]);
    expect(record.discharges).toEqual([]);
    expect(infoSpy).toHaveBeenCalledWith(
      '[RepositoryValidation] Salvaged 2026-03-04',
      expect.objectContaining({
        salvagedBeds: ['R1'],
      })
    );

    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
