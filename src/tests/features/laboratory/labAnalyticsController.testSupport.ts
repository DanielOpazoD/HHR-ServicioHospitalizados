import { vi } from 'vitest';
import type { LabResultRow, SyslabExamDetail, SyslabExamItem } from '@/types/domain/labExamTypes';

vi.mock('@/services/utils/loggerScope', () => ({
  createScopedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

export const buildExam = (overrides: Partial<SyslabExamItem> = {}): SyslabExamItem => ({
  id: '100',
  link: 'http://example.com/100',
  date: '06/04/2026',
  time: '10:00:00',
  patientName: 'TEST',
  origin: 'HOSP',
  exams: ['HEMOGRAMA'],
  ...overrides,
});

export const buildFinding = (overrides: Partial<LabResultRow> = {}): LabResultRow => ({
  section: 'GENERAL',
  analysis: 'Hemoglobina',
  result: '14',
  unit: 'g/dL',
  refValue: '12-16',
  ...overrides,
});

export const buildDetail = (overrides: Partial<SyslabExamDetail> = {}): SyslabExamDetail => ({
  url: 'http://example.com/100',
  findings: [],
  ...overrides,
});
