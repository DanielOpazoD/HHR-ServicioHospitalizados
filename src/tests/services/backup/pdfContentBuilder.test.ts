import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildHandoffPdfContent } from '@/services/backup/pdfContentBuilder';
import { ShiftType } from '@/types';

describe('pdfContentBuilder', () => {
  type HandoffRecord = Parameters<typeof buildHandoffPdfContent>[1];
  type AutoTableFn = Parameters<typeof buildHandoffPdfContent>[4];
  type JsPdfDoc = Parameters<typeof buildHandoffPdfContent>[0];

  let mockDoc: JsPdfDoc;
  let mockAutoTable: ReturnType<typeof vi.fn>;
  const mockRecord = {
    date: '2025-01-01',
    beds: {
      R1: {
        patientName: 'John Doe',
        rut: '12.345.678-9',
        admissionDate: '2025-01-01',
        status: 'Estable',
        pathology: 'Diagnosis',
        devices: ['VVP#1'],
        handoffNoteDayShift: 'Day note',
      },
    },
    nursesDayShift: ['Nurse A'],
    handoffDayChecklist: { escalaBraden: true },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockDoc = {
      internal: {
        pageSize: { width: 210, height: 297 },
      },
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      setTextColor: vi.fn(),
      text: vi.fn(),
      addImage: vi.fn(),
      setDrawColor: vi.fn(),
      line: vi.fn(),
      setPage: vi.fn(),
      splitTextToSize: vi.fn(text => [text]),
      lastAutoTable: { finalY: 100 },
      getNumberOfPages: vi.fn(() => 1),
    } as unknown as JsPdfDoc;
    mockAutoTable = vi.fn();

    // Mock global Image for getBase64ImageFromURL
    global.Image = class {
      onload?: () => void;
      onerror?: (error?: unknown) => void;
      src: string = '';
      constructor() {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 10);
      }
    } as unknown as typeof Image;
    Object.defineProperty(global.document, 'createElement', {
      value: vi.fn().mockReturnValue({
        getContext: () => ({ drawImage: vi.fn() }),
        toDataURL: () => 'data:image/png;base64,mock',
      }),
      writable: true,
      configurable: true,
    });
  });

  it('should build PDF content without crashing', async () => {
    await buildHandoffPdfContent(
      mockDoc,
      mockRecord as unknown as HandoffRecord,
      'day' as ShiftType,
      { dayStart: '08:00', dayEnd: '20:00' },
      mockAutoTable as unknown as AutoTableFn
    );

    expect(mockDoc.text).toHaveBeenCalled();
    expect(mockAutoTable).toHaveBeenCalled();
    const tableBody = mockAutoTable.mock.calls[0][1].body;
    expect(
      tableBody.some((row: Array<{ content?: string }>) => row[1]?.content?.includes('John Doe'))
    ).toBe(true);
  });

  it('should handle missing logo gracefully', async () => {
    global.Image = class {
      onload?: () => void;
      onerror?: (error?: unknown) => void;
      src: string = '';
      constructor() {
        setTimeout(() => {
          if (this.onerror) this.onerror(new Error('Fail'));
        }, 10);
      }
    } as unknown as typeof Image;

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await buildHandoffPdfContent(
      mockDoc,
      mockRecord as unknown as HandoffRecord,
      'day',
      {},
      mockAutoTable as unknown as AutoTableFn
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Could not load logo'),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('should handle nursing handoff night shift', async () => {
    const nightRecord = {
      ...mockRecord,
      nursesNightShift: ['Nurse B'],
      handoffNightChecklist: { estadistica: true },
      handoffNovedadesNightShift: 'Night news',
    };

    await buildHandoffPdfContent(
      mockDoc,
      nightRecord as unknown as HandoffRecord,
      'night',
      {},
      mockAutoTable as unknown as AutoTableFn
    );

    // More flexible assertion for text
    expect(mockDoc.text).toHaveBeenCalledWith(
      expect.stringContaining('TURNO NOCHE'),
      expect.any(Number),
      expect.any(Number),
      expect.any(Object)
    );
  });

  it('should handle empty patient list', async () => {
    const emptyRecord = { ...mockRecord, beds: {} };
    await buildHandoffPdfContent(
      mockDoc,
      emptyRecord as unknown as HandoffRecord,
      'day',
      {},
      mockAutoTable as unknown as AutoTableFn
    );
    const tableBody = mockAutoTable.mock.calls[0][1].body;
    expect(tableBody[0][0].content).toBe('No hay pacientes registrados.');
  });
});
