import { describe, it, expect, vi } from 'vitest';
import { addCudyrTable } from '@/services/pdf/handoffPdfCudyrSection';
import type { DailyRecord } from '@/types';

const createDocMock = () =>
  ({
    addPage: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    text: vi.fn(),
    lastAutoTable: { finalY: 100 },
  }) as unknown as Parameters<typeof addCudyrTable>[0];

describe('handoffPdfCudyrSection', () => {
  it('renders canonical night-shift nurses in the CUDYR header', () => {
    const doc = createDocMock();
    const autoTable = vi.fn();
    const record = {
      date: '2026-03-07',
      beds: {},
      discharges: [],
      transfers: [],
      cma: [],
      lastUpdated: '2026-03-07T10:00:00.000Z',
      nursesNightShift: ['Carla', 'Rosa'],
    } as unknown as DailyRecord;

    addCudyrTable(doc, record, 10, autoTable as never);

    expect(doc.text).toHaveBeenCalledWith(
      expect.stringContaining('Enfermeros/as (Noche): Carla, Rosa'),
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('falls back to "No registrados" when no canonical night-shift nurses exist', () => {
    const doc = createDocMock();
    const autoTable = vi.fn();
    const record = {
      date: '2026-03-07',
      beds: {},
      discharges: [],
      transfers: [],
      cma: [],
      lastUpdated: '2026-03-07T10:00:00.000Z',
      nursesNightShift: ['', ''],
    } as unknown as DailyRecord;

    addCudyrTable(doc, record, 10, autoTable as never);

    expect(doc.text).toHaveBeenCalledWith(
      expect.stringContaining('Enfermeros/as (Noche): No registrados'),
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('renders the last CUDYR modification time with lock fallback in the PDF header', () => {
    const doc = createDocMock();
    const autoTable = vi.fn();
    const record = {
      date: '2026-03-07',
      beds: {},
      discharges: [],
      transfers: [],
      cma: [],
      lastUpdated: '2026-03-07T10:00:00.000Z',
      cudyrUpdatedAt: '2026-03-07T21:45:00',
    } as unknown as DailyRecord;

    addCudyrTable(doc, record, 10, autoTable as never);

    expect(doc.text).toHaveBeenCalledWith(
      expect.stringContaining('Últ. mod. CUDYR: 21:45'),
      expect.any(Number),
      expect.any(Number)
    );
  });
});
