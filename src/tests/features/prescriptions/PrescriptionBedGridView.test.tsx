/**
 * Tests for the bed-grid view. Mocks the daily-record loader and the
 * Storage URL resolver so the component renders deterministically, then
 * exercises the drag-and-drop assignment flow (drop into a matching
 * column triggers `onAssign` with the row's bed/patient).
 */

import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UIProvider } from '@/context/UIContext';

vi.mock('@/services/storage/firestore/firestoreRecordQueries', () => ({
  getRecordFromFirestore: vi.fn(),
}));

vi.mock('@/features/prescriptions/services/prescriptionStorageImageService', () => ({
  resolvePrescriptionImageDownloadUrl: vi.fn(async (path: string) => `https://stub/${path}`),
}));

import { getRecordFromFirestore } from '@/services/storage/firestore/firestoreRecordQueries';
import { PrescriptionBedGridView } from '@/features/prescriptions/components/PrescriptionBedGridView';
import type { PrescriptionRecord } from '@/types/prescriptionTypes';
import type { DailyRecord } from '@/services/storage/storageDailyRecordContracts';

const buildRecord = (
  id: string,
  overrides: Partial<PrescriptionRecord> = {}
): PrescriptionRecord => ({
  id,
  hospitalId: 'hhr',
  prescriptionType: 'comun',
  image: {
    storagePath: `prescriptions/hhr/${id}/full.jpg`,
    thumbnailStoragePath: `prescriptions/hhr/${id}/thumb.jpg`,
    byteSize: 200_000,
    width: 1200,
    height: 900,
    contentType: 'image/jpeg',
  },
  uploader: { source: 'qr_pin' },
  createdAt: '2026-05-04T10:00:00.000Z',
  expiresAt: '2026-06-03T10:00:00.000Z',
  ...overrides,
});

const buildDailyRecord = (): DailyRecord =>
  ({
    date: '2026-05-04',
    beds: {
      H1C2: {
        bedId: 'H1C2',
        isBlocked: false,
        bedMode: 'Cama',
        hasCompanionCrib: false,
        patientName: 'Carina Pate Lillo',
        rut: '14.470.055-4',
        age: '60',
        pathology: '—',
      },
    },
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated: '2026-05-04T10:00:00.000Z',
    activeExtraBeds: [],
  }) as unknown as DailyRecord;

const renderGrid = (ui: React.ReactElement) => render(<UIProvider>{ui}</UIProvider>);

describe('PrescriptionBedGridView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRecordFromFirestore).mockResolvedValue(buildDailyRecord());
  });

  it('lists pending unassigned prescriptions in the tray', async () => {
    const unassigned = buildRecord('rx-pending', { bedId: undefined, patientName: undefined });
    renderGrid(<PrescriptionBedGridView records={[unassigned]} dayIso="2026-05-04" />);

    await waitFor(() => expect(screen.getByTestId('prescription-unassigned-tray')).toBeTruthy());
    expect(screen.getByTestId('prescription-unassigned-card-rx-pending')).toBeTruthy();
  });

  it('drops a matching-type unassigned prescription onto a bed cell and calls onAssign', async () => {
    const unassigned = buildRecord('rx-drag', {
      bedId: undefined,
      patientName: undefined,
      prescriptionType: 'comun',
    });
    const onAssign = vi.fn(async () => undefined);

    renderGrid(
      <PrescriptionBedGridView records={[unassigned]} dayIso="2026-05-04" onAssign={onAssign} />
    );

    const card = await screen.findByTestId('prescription-unassigned-card-rx-drag');
    const cell = await screen.findByTestId('prescription-bed-cell-H1C2-comun');

    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn(() => 'rx-drag'),
      types: ['text/plain'],
    };

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(cell, { dataTransfer });
    fireEvent.drop(cell, { dataTransfer });

    await waitFor(() => expect(onAssign).toHaveBeenCalledTimes(1));
    expect(onAssign).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rx-drag' }),
      expect.objectContaining({
        bedId: 'H1C2',
        patientName: 'Carina Pate Lillo',
        patientRut: '14.470.055-4',
      })
    );
  });

  it('does not call onAssign when dropping onto a non-matching type column', async () => {
    const unassigned = buildRecord('rx-mismatch', {
      bedId: undefined,
      patientName: undefined,
      prescriptionType: 'comun',
    });
    const onAssign = vi.fn(async () => undefined);

    renderGrid(
      <PrescriptionBedGridView records={[unassigned]} dayIso="2026-05-04" onAssign={onAssign} />
    );

    const card = await screen.findByTestId('prescription-unassigned-card-rx-mismatch');
    const wrongCell = await screen.findByTestId('prescription-bed-cell-H1C2-psicotropicos');

    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn(() => 'rx-mismatch'),
      types: ['text/plain'],
    };

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(wrongCell, { dataTransfer });
    fireEvent.drop(wrongCell, { dataTransfer });

    // Drop event was processed but onAssign should not fire because of type mismatch.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(onAssign).not.toHaveBeenCalled();
  });

  it('navigates between prescriptions for the same patient in the image viewer', async () => {
    const first = buildRecord('rx-first', {
      bedId: 'H1C2',
      patientName: 'Carina Pate Lillo',
      patientRut: '14.470.055-4',
      prescriptionType: 'comun',
    });
    const second = buildRecord('rx-second', {
      bedId: 'H1C2',
      patientName: 'Carina Pate Lillo',
      patientRut: '14.470.055-4',
      prescriptionType: 'psicotropicos',
    });

    renderGrid(<PrescriptionBedGridView records={[first, second]} dayIso="2026-05-04" />);

    const thumbnail = await screen.findByRole('img', { name: /comun · h1c2/i });
    fireEvent.click(thumbnail.closest('button')!);

    const dialogImage = await screen.findByRole('img', { name: /receta 1 de 2/i });
    expect(dialogImage).toHaveAttribute('src', 'https://stub/prescriptions/hhr/rx-first/full.jpg');

    fireEvent.click(screen.getByRole('button', { name: /receta siguiente/i }));

    await waitFor(() =>
      expect(screen.getByRole('img', { name: /receta 2 de 2/i })).toHaveAttribute(
        'src',
        'https://stub/prescriptions/hhr/rx-second/full.jpg'
      )
    );
  });

  it('confirms and deletes the selected prescription from the image viewer', async () => {
    const record = buildRecord('rx-delete', {
      bedId: 'H1C2',
      patientName: 'Carina Pate Lillo',
      patientRut: '14.470.055-4',
    });
    const onDelete = vi.fn(async () => undefined);

    renderGrid(
      <PrescriptionBedGridView records={[record]} dayIso="2026-05-04" onDelete={onDelete} />
    );

    const thumbnail = await screen.findByRole('img', { name: /comun · h1c2/i });
    fireEvent.click(thumbnail.closest('button')!);
    await screen.findByRole('dialog', { name: /vista ampliada/i });

    fireEvent.click(screen.getByRole('button', { name: /eliminar receta/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^eliminar$/i }));

    await waitFor(() =>
      expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: record.id }))
    );
  });
});
