import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePatientAnalysis } from '@/hooks/usePatientAnalysis';
import {
  defaultDailyRecordReadPort,
  defaultDailyRecordWritePort,
} from '@/application/ports/dailyRecordPort';
import { defaultPatientMasterWritePort } from '@/application/ports/patientMasterPort';

vi.mock('@/application/ports/dailyRecordPort', () => ({
  defaultDailyRecordReadPort: {
    getAvailableDates: vi.fn(),
    getForDate: vi.fn(),
  },
  defaultDailyRecordWritePort: {
    updatePartial: vi.fn(),
  },
}));

vi.mock('@/application/ports/patientMasterPort', () => ({
  defaultPatientMasterWritePort: {
    bulkUpsertPatients: vi.fn(),
  },
}));

vi.mock('@/services/admin/utils/auditUtils', () => ({
  getCurrentUserEmail: vi.fn().mockReturnValue('test@test.com'),
}));

describe('usePatientAnalysis', () => {
  const asRepoRecord = <T>(value: T) =>
    value as unknown as Awaited<ReturnType<typeof defaultDailyRecordReadPort.getForDate>>;

  const dailyRecordReadPort = vi.mocked(defaultDailyRecordReadPort);
  const dailyRecordWritePort = vi.mocked(defaultDailyRecordWritePort);
  const patientMasterWritePort = vi.mocked(defaultPatientMasterWritePort);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run analysis and detect patients', async () => {
    const mockDates = ['2025-01-01'];
    const mockRecord = {
      date: '2025-01-01',
      beds: {
        'Bed-1': {
          rut: '11.111.111-1',
          patientName: 'John Doe',
          admissionDate: '2025-01-01',
        },
      },
    };

    dailyRecordReadPort.getAvailableDates.mockResolvedValue(mockDates);
    dailyRecordReadPort.getForDate.mockResolvedValue(asRepoRecord(mockRecord));

    const { result } = renderHook(() => usePatientAnalysis());

    await act(async () => {
      await result.current.runAnalysis();
    });

    expect(result.current.analysis).not.toBeNull();
    expect(result.current.analysis?.uniquePatients).toBe(1);
    expect(result.current.analysis?.validPatients[0].fullName).toBe('John Doe');
  });

  it('should detect name conflicts', async () => {
    const mockDates = ['2025-01-01', '2025-01-02'];
    const record1 = {
      date: '2025-01-01',
      beds: { B1: { rut: '11.111.111-1', patientName: 'John Doe' } },
    };
    const record2 = {
      date: '2025-01-02',
      beds: { B1: { rut: '11.111.111-1', patientName: 'John Smith' } },
    };

    dailyRecordReadPort.getAvailableDates.mockResolvedValue(mockDates);
    dailyRecordReadPort.getForDate
      .mockResolvedValueOnce(asRepoRecord(record1))
      .mockResolvedValueOnce(asRepoRecord(record2));

    const { result } = renderHook(() => usePatientAnalysis());

    await act(async () => {
      await result.current.runAnalysis();
    });

    expect(result.current.analysis?.conflicts).toHaveLength(1);
    expect(result.current.analysis?.conflicts[0].options).toContain('John Doe');
    expect(result.current.analysis?.conflicts[0].options).toContain('John Smith');
  });

  it('should resolve conflicts and harmonize history', async () => {
    // Setup initial state via analysis: Two days, different names for same RUT
    const mockDates = ['2025-01-01', '2025-01-02'];
    const record1 = {
      date: '2025-01-01',
      beds: { B1: { rut: '11.111.111-1', patientName: 'John Old' } },
    };
    const record2 = {
      date: '2025-01-02',
      beds: { B1: { rut: '11.111.111-1', patientName: 'John New' } },
    };
    dailyRecordReadPort.getAvailableDates.mockResolvedValue(mockDates);
    dailyRecordReadPort.getForDate
      .mockResolvedValueOnce(asRepoRecord(record1))
      .mockResolvedValueOnce(asRepoRecord(record2));

    const { result } = renderHook(() => usePatientAnalysis());

    await act(async () => {
      await result.current.runAnalysis();
    });

    // Now resolve it
    await act(async () => {
      await result.current.resolveConflict('11.111.111-1', 'John Doe', true);
    });

    expect(dailyRecordWritePort.updatePartial).toHaveBeenCalled();
    expect(result.current.analysis?.conflicts).toHaveLength(0);
  });

  it('should track admissions and ongoing events', async () => {
    const mockDates = ['2025-01-01', '2025-01-02'];
    const record1 = {
      date: '2025-01-01',
      beds: { B1: { rut: '11.111.111-1', patientName: 'John Doe', admissionDate: '2025-01-01' } },
    };
    const record2 = {
      date: '2025-01-02',
      beds: { B1: { rut: '11.111.111-1', patientName: 'John Doe', admissionDate: '2025-01-01' } },
    };
    dailyRecordReadPort.getAvailableDates.mockResolvedValue(mockDates);
    dailyRecordReadPort.getForDate
      .mockResolvedValueOnce(asRepoRecord(record1))
      .mockResolvedValueOnce(asRepoRecord(record2));

    const { result } = renderHook(() => usePatientAnalysis());
    await act(async () => {
      await result.current.runAnalysis();
    });

    const patient = result.current.analysis?.validPatients[0];
    // Should have 1 admission record, not 2 (second is an extension)
    const admissions = patient?.hospitalizations?.filter(h => h.type === 'Ingreso');
    expect(admissions).toHaveLength(1);
  });

  it('should track explicit discharges', async () => {
    const mockDates = ['2025-01-01'];
    const record1 = {
      date: '2025-01-01',
      beds: { B1: { rut: '11.111.111-1', patientName: 'John Doe' } },
      discharges: [{ rut: '11.111.111-1', bedName: 'B1', diagnosis: 'Done', status: 'Alta' }],
    };
    dailyRecordReadPort.getAvailableDates.mockResolvedValue(mockDates);
    dailyRecordReadPort.getForDate.mockResolvedValue(asRepoRecord(record1));

    const { result } = renderHook(() => usePatientAnalysis());
    await act(async () => {
      await result.current.runAnalysis();
    });

    const patient = result.current.analysis?.validPatients[0];
    const egresos = patient?.hospitalizations?.filter(h => h.type === 'Egreso');
    expect(egresos).toHaveLength(1);
  });

  it('should track silent discharges', async () => {
    const mockDates = ['2025-01-01', '2025-01-02'];
    const record1 = {
      date: '2025-01-01',
      beds: { B1: { rut: '11.111.111-1', patientName: 'John Doe' } },
    };
    const record2 = {
      date: '2025-01-02',
      beds: {}, // Patient gone without explicit discharge
    };
    dailyRecordReadPort.getAvailableDates.mockResolvedValue(mockDates);
    dailyRecordReadPort.getForDate
      .mockResolvedValueOnce(asRepoRecord(record1))
      .mockResolvedValueOnce(asRepoRecord(record2));

    const { result } = renderHook(() => usePatientAnalysis());
    await act(async () => {
      await result.current.runAnalysis();
    });

    const patient = result.current.analysis?.validPatients[0];
    const autoEgresos = patient?.hospitalizations?.filter(h => h.type === 'Egreso');
    expect(autoEgresos).toHaveLength(1);
    expect(autoEgresos?.[0].id).toContain('egreso-auto');
  });

  it('should track transfers', async () => {
    const mockDates = ['2025-01-01'];
    const record = {
      date: '2025-01-01',
      beds: { B1: { rut: '11.111.111-1', patientName: 'John Doe' } },
      transfers: [
        { rut: '11.111.111-1', bedName: 'B1', diagnosis: 'Heart', receivingCenter: 'Other Clinic' },
      ],
    };
    dailyRecordReadPort.getAvailableDates.mockResolvedValue(mockDates);
    dailyRecordReadPort.getForDate.mockResolvedValue(asRepoRecord(record));

    const { result } = renderHook(() => usePatientAnalysis());
    await act(async () => {
      await result.current.runAnalysis();
    });

    const patient = result.current.analysis?.validPatients[0];
    const traslados = patient?.hospitalizations?.filter(h => h.type === 'Traslado');
    expect(traslados).toHaveLength(1);
    expect(traslados?.[0].receivingCenter).toBe('Other Clinic');
  });

  it('should track death events', async () => {
    const mockDates = ['2025-01-01'];
    const record = {
      date: '2025-01-01',
      beds: { B1: { rut: '11.111.111-1', patientName: 'John Doe' } },
      discharges: [
        { rut: '11.111.111-1', bedName: 'B1', status: 'Fallecido', diagnosis: 'Sepsis' },
      ],
    };
    dailyRecordReadPort.getAvailableDates.mockResolvedValue(mockDates);
    dailyRecordReadPort.getForDate.mockResolvedValue(asRepoRecord(record));

    const { result } = renderHook(() => usePatientAnalysis());
    await act(async () => {
      await result.current.runAnalysis();
    });

    const patient = result.current.analysis?.validPatients[0];
    expect(patient?.vitalStatus).toBe('Fallecido');
    const deathEvent = patient?.hospitalizations?.filter(h => h.type === 'Fallecimiento');
    expect(deathEvent).toHaveLength(1);
  });

  it('should resolve conflict without harmonization', async () => {
    const mockDates = ['2025-01-01', '2025-01-02'];
    const r1 = { beds: { B1: { rut: '11.111.111-1', patientName: 'N1' } } };
    const r2 = { beds: { B1: { rut: '11.111.111-1', patientName: 'N2' } } };
    dailyRecordReadPort.getAvailableDates.mockResolvedValue(mockDates);
    dailyRecordReadPort.getForDate
      .mockResolvedValueOnce(asRepoRecord(r1))
      .mockResolvedValueOnce(asRepoRecord(r2));

    const { result } = renderHook(() => usePatientAnalysis());
    await act(async () => {
      await result.current.runAnalysis();
    });

    await act(async () => {
      await result.current.resolveConflict('11.111.111-1', 'Correct Name', false);
    });

    expect(dailyRecordWritePort.updatePartial).not.toHaveBeenCalled();
    expect(result.current.analysis?.validPatients[0].fullName).toBe('Correct Name');
  });

  it('should handle demographic mismatches during analysis', async () => {
    const mockDates = ['2025-01-01', '2025-01-02'];
    const record1 = {
      date: '2025-01-01',
      beds: {
        B1: {
          rut: '11.111.111-1',
          patientName: 'John',
          birthDate: '1990-01-01',
          biologicalSex: 'Masculino',
          isRapanui: false,
        },
      },
    };
    const record2 = {
      date: '2025-01-02',
      beds: {
        B1: {
          rut: '11.111.111-1',
          patientName: 'John',
          birthDate: '1991-01-01', // mismatch
          biologicalSex: 'Femenino', // mismatch
          isRapanui: true, // mismatch
        },
      },
    };
    dailyRecordReadPort.getAvailableDates.mockResolvedValue(mockDates);
    dailyRecordReadPort.getForDate
      .mockResolvedValueOnce(asRepoRecord(record1))
      .mockResolvedValueOnce(asRepoRecord(record2));

    const { result } = renderHook(() => usePatientAnalysis());
    await act(async () => {
      await result.current.runAnalysis();
    });

    expect(result.current.analysis?.uniquePatients).toBe(1);
  });

  it('should return early in resolveConflict if conflict or analysis missing', async () => {
    const { result } = renderHook(() => usePatientAnalysis());

    // No analysis run yet
    await act(async () => {
      await result.current.resolveConflict('123', 'Name', true);
    });
    expect(dailyRecordWritePort.updatePartial).not.toHaveBeenCalled();
  });

  it('should run migration and handle success', async () => {
    const mockDates = ['2025-01-01'];
    const record1 = {
      date: '2025-01-01',
      beds: { B1: { rut: '11.111.111-1', patientName: 'John D.' } },
    };
    dailyRecordReadPort.getAvailableDates.mockResolvedValue(mockDates);
    dailyRecordReadPort.getForDate.mockResolvedValue(asRepoRecord(record1));
    patientMasterWritePort.bulkUpsertPatients.mockResolvedValue({
      successes: 1,
      errors: 0,
    });

    const { result } = renderHook(() => usePatientAnalysis());

    await act(async () => {
      await result.current.runAnalysis();
    });

    await act(async () => {
      await result.current.runMigration();
    });

    expect(result.current.migrationResult?.successes).toBe(1);
  });

  it('should handle migration failure', async () => {
    const mockDates = ['2025-01-01'];
    const record1 = {
      date: '2025-01-01',
      beds: { B1: { rut: '11.111.111-1', patientName: 'John' } },
    };
    dailyRecordReadPort.getAvailableDates.mockResolvedValue(mockDates);
    dailyRecordReadPort.getForDate.mockResolvedValue(asRepoRecord(record1));
    patientMasterWritePort.bulkUpsertPatients.mockRejectedValue(new Error('Migration fail'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => usePatientAnalysis());
    await act(async () => {
      await result.current.runAnalysis();
    });
    await act(async () => {
      await result.current.runMigration();
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[usePatientAnalysis] Migration failed'),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('should prefer userSafeMessage for migration failures', async () => {
    const mockDates = ['2025-01-01'];
    const record1 = {
      date: '2025-01-01',
      beds: { B1: { rut: '11.111.111-1', patientName: 'John' } },
    };
    dailyRecordReadPort.getAvailableDates.mockResolvedValue(mockDates);
    dailyRecordReadPort.getForDate.mockResolvedValue(asRepoRecord(record1));
    patientMasterWritePort.bulkUpsertPatients.mockRejectedValue(new Error('Migration fail'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => usePatientAnalysis());
    await act(async () => {
      await result.current.runAnalysis();
    });
    await act(async () => {
      await result.current.runMigration();
    });

    expect(consoleSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ message: 'Migration fail' })
    );
    consoleSpy.mockRestore();
  });

  it('should handle analysis failure', async () => {
    dailyRecordReadPort.getAvailableDates.mockRejectedValue(new Error('Analysis fail'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => usePatientAnalysis());
    await act(async () => {
      await result.current.runAnalysis();
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[usePatientAnalysis] Analysis failed'),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('should prefer userSafeMessage for analysis failures', async () => {
    dailyRecordReadPort.getAvailableDates.mockRejectedValue(new Error('Analysis fail'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => usePatientAnalysis());
    await act(async () => {
      await result.current.runAnalysis();
    });

    expect(consoleSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ message: 'Analysis fail' })
    );
    consoleSpy.mockRestore();
  });

  it('should detect name conflicts across 3+ variations/days', async () => {
    const mockDates = ['2025-01-01', '2025-01-02', '2025-01-03'];
    const records = [
      { date: '2025-01-01', beds: { B1: { rut: '11.111.111-1', patientName: 'N1' } } },
      { date: '2025-01-02', beds: { B1: { rut: '11.111.111-1', patientName: 'N2' } } },
      { date: '2025-01-03', beds: { B1: { rut: '11.111.111-1', patientName: 'N3' } } },
    ];

    dailyRecordReadPort.getAvailableDates.mockResolvedValue(mockDates);
    dailyRecordReadPort.getForDate
      .mockResolvedValueOnce(asRepoRecord(records[0]))
      .mockResolvedValueOnce(asRepoRecord(records[1]))
      .mockResolvedValueOnce(asRepoRecord(records[2]));

    const { result } = renderHook(() => usePatientAnalysis());
    await act(async () => {
      await result.current.runAnalysis();
    });

    expect(result.current.analysis?.conflicts[0].options).toHaveLength(3);
    expect(result.current.analysis?.conflicts[0].records).toHaveLength(2); // First record is base, next 2 are conflicts
  });

  it('uses injected dependencies instead of default ports', async () => {
    const customDailyRecordRepository = {
      getAvailableDates: vi.fn().mockResolvedValue(['2025-01-01']),
      getForDate: vi.fn().mockResolvedValue(
        asRepoRecord({
          date: '2025-01-01',
          beds: { B1: { rut: '11.111.111-1', patientName: 'Injected Patient' } },
        })
      ),
      updatePartial: vi.fn(),
    };
    const customPatientMasterRepository = {
      bulkUpsertPatients: vi.fn().mockResolvedValue({ successes: 1, errors: 0 }),
    };
    const customAuditPort = {
      writeEvent: vi.fn().mockResolvedValue(undefined),
    };
    const getInjectedUserEmail = vi.fn().mockReturnValue('inject@test.com');

    const { result } = renderHook(() =>
      usePatientAnalysis({
        dailyRecordRepository: customDailyRecordRepository,
        patientMasterRepository: customPatientMasterRepository,
        auditPort: customAuditPort,
        getCurrentUserEmail: getInjectedUserEmail,
      })
    );

    await act(async () => {
      await result.current.runAnalysis();
    });

    await act(async () => {
      await result.current.runMigration();
    });

    expect(customDailyRecordRepository.getAvailableDates).toHaveBeenCalled();
    expect(customDailyRecordRepository.getForDate).toHaveBeenCalledWith('2025-01-01');
    expect(customPatientMasterRepository.bulkUpsertPatients).toHaveBeenCalled();
    expect(dailyRecordReadPort.getAvailableDates).not.toHaveBeenCalled();
    expect(patientMasterWritePort.bulkUpsertPatients).not.toHaveBeenCalled();
  });
});
