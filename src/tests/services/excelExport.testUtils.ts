import * as fs from 'node:fs';
import * as path from 'node:path';
import { vi } from 'vitest';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { UpcChecklistRecord } from '@/domain/upc/upcContracts';

export const FIXED_ISO_TIMESTAMP = '2026-01-15T10:30:00.000Z';

export const readSource = (relativePath: string): string =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

export const toDailyRecord = (partial: Partial<DailyRecord>) => partial as unknown as DailyRecord;

export const buildUpcChecklist = (
  classification: UpcChecklistRecord['classification']
): UpcChecklistRecord => ({
  classification,
  uciCriteria: classification === 'UPC_UCI' ? ['uci_vmi'] : [],
  utiCriteria: classification === 'UPC_UTI' ? ['uti_mon_cardiaca'] : [],
  evaluatedAt: FIXED_ISO_TIMESTAMP,
});

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

vi.mock('@/services/repositories/dailyRecordRepositoryReadService', () => ({
  getForDate: vi.fn(),
}));

vi.mock('@/services/storage/indexeddb/indexedDbRecordService', () => ({
  getAllRecords: vi.fn(),
}));
