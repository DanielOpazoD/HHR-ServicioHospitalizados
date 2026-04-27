import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getDefaultClinicalDocumentIndicationsCatalog,
  addClinicalDocumentIndicationCatalogItem,
  deleteClinicalDocumentIndicationCatalogItem,
  ensureClinicalDocumentIndicationsCatalog,
  replaceClinicalDocumentIndicationsCatalog,
  subscribeToClinicalDocumentIndicationsCatalog,
  updateClinicalDocumentIndicationCatalogItem,
} from '@/features/clinical-documents/services/clinicalDocumentIndicationsCatalogService';
import { useClinicalDocumentIndicationsCatalog } from '@/features/clinical-documents/hooks/useClinicalDocumentIndicationsCatalog';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';

vi.mock('@/services/utils/loggerScope', async () => {
  const { createLoggerScopeMock } = await import('@/tests/utils/loggerScopeMock');
  return createLoggerScopeMock();
});

vi.mock('@/services/repositories/repositoryConfig', () => ({
  isFirestoreEnabled: vi.fn(() => true),
}));

vi.mock(
  '@/features/clinical-documents/services/clinicalDocumentIndicationsCatalogService',
  async () => {
    const actual = await vi.importActual<
      typeof import('@/features/clinical-documents/services/clinicalDocumentIndicationsCatalogService')
    >('@/features/clinical-documents/services/clinicalDocumentIndicationsCatalogService');

    return {
      ...actual,
      subscribeToClinicalDocumentIndicationsCatalog: vi.fn(),
      ensureClinicalDocumentIndicationsCatalog: vi.fn(),
      addClinicalDocumentIndicationCatalogItem: vi.fn(),
      updateClinicalDocumentIndicationCatalogItem: vi.fn(),
      deleteClinicalDocumentIndicationCatalogItem: vi.fn(),
      replaceClinicalDocumentIndicationsCatalog: vi.fn(),
    };
  }
);

describe('useClinicalDocumentIndicationsCatalog', () => {
  const unsubscribe = vi.fn();
  const defaultCatalog = getDefaultClinicalDocumentIndicationsCatalog();

  beforeEach(() => {
    vi.clearAllMocks();
    unsubscribe.mockReset();
    vi.mocked(subscribeToClinicalDocumentIndicationsCatalog).mockReturnValue(unsubscribe);
    vi.mocked(ensureClinicalDocumentIndicationsCatalog).mockResolvedValue(defaultCatalog);
    vi.mocked(addClinicalDocumentIndicationCatalogItem).mockResolvedValue(defaultCatalog);
    vi.mocked(updateClinicalDocumentIndicationCatalogItem).mockResolvedValue(defaultCatalog);
    vi.mocked(deleteClinicalDocumentIndicationCatalogItem).mockResolvedValue(defaultCatalog);
    vi.mocked(replaceClinicalDocumentIndicationsCatalog).mockResolvedValue(defaultCatalog);
    vi.mocked(isFirestoreEnabled).mockReturnValue(true);
  });

  it('stays idle when the catalog is not active', () => {
    const { result } = renderHook(() =>
      useClinicalDocumentIndicationsCatalog({
        hospitalId: 'hhr',
        isActive: false,
        canEdit: true,
      })
    );

    expect(result.current.indicationsCatalog.version).toBe(defaultCatalog.version);
    expect(result.current.indicationsCatalog.specialties).toEqual(defaultCatalog.specialties);
    expect(subscribeToClinicalDocumentIndicationsCatalog).not.toHaveBeenCalled();
    expect(ensureClinicalDocumentIndicationsCatalog).not.toHaveBeenCalled();
  });

  it('subscribes and seeds the catalog when active with edit access', async () => {
    renderHook(() =>
      useClinicalDocumentIndicationsCatalog({
        hospitalId: 'hhr',
        isActive: true,
        canEdit: true,
      })
    );

    await waitFor(() => {
      expect(subscribeToClinicalDocumentIndicationsCatalog).toHaveBeenCalledWith(
        expect.any(Function),
        'hhr'
      );
    });
    expect(ensureClinicalDocumentIndicationsCatalog).toHaveBeenCalledWith('hhr');
  });

  it('uses the default catalog without remote subscription or seeding when Firestore is disabled', async () => {
    vi.mocked(isFirestoreEnabled).mockReturnValue(false);

    const { result } = renderHook(() =>
      useClinicalDocumentIndicationsCatalog({
        hospitalId: 'hhr',
        isActive: true,
        canEdit: true,
      })
    );

    await waitFor(() => {
      expect(result.current.indicationsCatalog.version).toBe(defaultCatalog.version);
    });
    expect(subscribeToClinicalDocumentIndicationsCatalog).not.toHaveBeenCalled();
    expect(ensureClinicalDocumentIndicationsCatalog).not.toHaveBeenCalled();
  });

  it('cleans up the subscription and skips seeding for read-only access', async () => {
    const { unmount } = renderHook(() =>
      useClinicalDocumentIndicationsCatalog({
        hospitalId: 'hhr',
        isActive: true,
        canEdit: false,
      })
    );

    await waitFor(() => {
      expect(subscribeToClinicalDocumentIndicationsCatalog).toHaveBeenCalled();
    });
    expect(ensureClinicalDocumentIndicationsCatalog).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('runs add, update, delete and import mutations successfully', async () => {
    const addedCatalog = {
      ...defaultCatalog,
      updatedAt: '2026-04-20T00:00:00.000Z',
    };
    const updatedCatalog = {
      ...addedCatalog,
      updatedAt: '2026-04-20T00:10:00.000Z',
    };
    const deletedCatalog = {
      ...updatedCatalog,
      updatedAt: '2026-04-20T00:20:00.000Z',
    };
    const importedCatalog = {
      ...deletedCatalog,
      updatedAt: '2026-04-20T00:30:00.000Z',
    };

    vi.mocked(addClinicalDocumentIndicationCatalogItem).mockResolvedValueOnce(addedCatalog);
    vi.mocked(updateClinicalDocumentIndicationCatalogItem).mockResolvedValueOnce(updatedCatalog);
    vi.mocked(deleteClinicalDocumentIndicationCatalogItem).mockResolvedValueOnce(deletedCatalog);
    vi.mocked(replaceClinicalDocumentIndicationsCatalog).mockResolvedValueOnce(importedCatalog);

    const { result } = renderHook(() =>
      useClinicalDocumentIndicationsCatalog({
        hospitalId: 'hhr',
        isActive: true,
        canEdit: true,
      })
    );

    await act(async () => {
      await expect(result.current.addCustomIndication('tmt', 'Nueva')).resolves.toBe(true);
      await expect(result.current.updateIndication('tmt', 'item-1', 'Actualizada')).resolves.toBe(
        true
      );
      await expect(result.current.deleteIndication('tmt', 'item-1')).resolves.toBe(true);
      await expect(result.current.importCatalog({ specialties: {} })).resolves.toBe(true);
    });

    expect(addClinicalDocumentIndicationCatalogItem).toHaveBeenCalledWith({
      hospitalId: 'hhr',
      specialtyId: 'tmt',
      text: 'Nueva',
    });
    expect(updateClinicalDocumentIndicationCatalogItem).toHaveBeenCalledWith({
      hospitalId: 'hhr',
      specialtyId: 'tmt',
      itemId: 'item-1',
      text: 'Actualizada',
    });
    expect(deleteClinicalDocumentIndicationCatalogItem).toHaveBeenCalledWith({
      hospitalId: 'hhr',
      specialtyId: 'tmt',
      itemId: 'item-1',
    });
    expect(replaceClinicalDocumentIndicationsCatalog).toHaveBeenCalledWith({
      hospitalId: 'hhr',
      catalog: { specialties: {} },
    });
    expect(result.current.indicationsCatalog).toEqual(importedCatalog);
    expect(result.current.isSavingCustomIndication).toBe(false);
    expect(result.current.customIndicationError).toBeNull();
  });

  it('surfaces a user-safe error when a mutation fails', async () => {
    vi.mocked(addClinicalDocumentIndicationCatalogItem).mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() =>
      useClinicalDocumentIndicationsCatalog({
        hospitalId: 'hhr',
        isActive: true,
        canEdit: true,
      })
    );

    await act(async () => {
      await expect(result.current.addCustomIndication('tmt', 'Nueva')).resolves.toBe(false);
    });

    expect(result.current.isSavingCustomIndication).toBe(false);
    expect(result.current.customIndicationError).toBe(
      'No se pudo guardar la indicación en Firebase.'
    );
  });
});
