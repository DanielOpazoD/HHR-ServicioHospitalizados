import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import type { LabPatient } from '@/types/domain/labExamTypes';
import type { LabAnalysisData } from '@/types/domain/labAnalyticsTypes';
import type { ExportConfig } from '@/features/laboratory/types/labViewerTypes';

const { createWorkbookMock, loggerErrorMock } = vi.hoisted(() => ({
  createWorkbookMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/services/exporters/excelUtils', () => ({
  createWorkbook: () => createWorkbookMock(),
}));

vi.mock('@/services/utils/loggerScope', async () => {
  const { createLoggerScopeMock } = await import('@/tests/utils/loggerScopeMock');
  return createLoggerScopeMock({ error: loggerErrorMock });
});

import { exportComparisonToExcel } from '@/features/laboratory/services/labExcelService';

describe('labExcelService', () => {
  let workbook: ExcelJS.Workbook;
  let anchorClickMock: ReturnType<typeof vi.fn>;

  const patient: LabPatient = {
    bedId: 'R1',
    label: 'R1 · José Test',
    patientName: 'José Test',
    rut: '12.345.678-9',
    birthDate: '1980-04-12',
  };

  const analysis: LabAnalysisData = {
    trendGroups: [],
    examDates: ['12/04/2026 08:00'],
    microbiologyEntries: [],
    comparison: {
      Hemoglobina: {
        '12/04/2026 08:00': {
          section: 'HEMOGRAMA',
          analysis: 'Hemoglobina',
          result: '13.4',
          unit: 'g/dL',
          refValue: '12-16',
        },
      },
    },
  };

  const config: ExportConfig = {
    selectedDates: new Set(['12/04/2026 08:00']),
    selectedVars: new Set(['Hemoglobina']),
  };

  beforeEach(() => {
    workbook = new ExcelJS.Workbook();
    vi.spyOn(workbook.xlsx, 'writeBuffer').mockResolvedValue(new ArrayBuffer(8));
    createWorkbookMock.mockResolvedValue(workbook);

    anchorClickMock = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(tagName => {
      if (tagName === 'a') {
        return {
          href: '',
          download: '',
          click: anchorClickMock,
        } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tagName);
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:lab');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes title and patient identity rows before the comparison table', async () => {
    await exportComparisonToExcel(analysis, config, patient);

    const sheet = workbook.getWorksheet('Comparación Lab');
    expect(sheet).toBeDefined();
    expect(sheet?.getCell('A1').value).toBe('Resumen de laboratorio');
    expect(sheet?.getCell('A3').value).toBe('Nombre: José Test');
    expect(sheet?.getCell('A4').value).toBe('RUT: 12.345.678-9');
    expect(sheet?.getCell('A5').value).toBe('Fecha de nacimiento: 12-04-1980');
    expect(sheet?.getCell('A7').value).toBe('Variable');
    expect(sheet?.getCell('B7').value).toBe('12/04/2026 08:00');
    expect(anchorClickMock).toHaveBeenCalledTimes(1);
  });
});
