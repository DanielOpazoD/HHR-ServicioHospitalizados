import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDoc, setDoc } from 'firebase/firestore';

import {
  addClinicalDocumentIndicationCatalogItem,
  deleteClinicalDocumentIndicationCatalogItem,
  getDefaultClinicalDocumentIndicationsCatalog,
  normalizeClinicalDocumentIndicationsCatalog,
  updateClinicalDocumentIndicationCatalogItem,
} from '@/features/clinical-documents/services/clinicalDocumentIndicationsCatalogService';

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    doc: vi.fn(() => ({ id: 'mock-doc' })),
    getDoc: vi.fn(),
    onSnapshot: vi.fn(),
    setDoc: vi.fn(),
  };
});

describe('clinicalDocumentIndicationsCatalogService', () => {
  type FirestoreDocResult = Awaited<ReturnType<typeof getDoc>>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds the seeded default catalog with TMT first and Cir without defaults', () => {
    const catalog = getDefaultClinicalDocumentIndicationsCatalog('2026-03-09T10:00:00.000Z');

    expect(catalog.updatedAt).toBe('2026-03-09T10:00:00.000Z');
    expect(Object.keys(catalog.specialties)).toEqual([
      'tmt',
      'cirugia',
      'medicina_interna',
      'psiquiatria',
      'ginecobstetricia',
      'pediatria',
    ]);
    expect(catalog.specialties.tmt.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Reposo Absoluto', source: 'default' }),
        expect.objectContaining({ text: 'Uso de Cabestrillo', source: 'default' }),
      ])
    );
    expect(catalog.specialties.cirugia.items).toEqual([]);
    expect(catalog.specialties.medicina_interna.items).toEqual([]);
  });

  it('keeps remote specialty items editable without re-injecting removed defaults', () => {
    const catalog = normalizeClinicalDocumentIndicationsCatalog({
      version: 3,
      specialties: {
        cirugia: {
          id: 'cirugia',
          label: 'Cirugía',
          items: [{ id: 'custom-1', text: 'Control en policlínico', source: 'custom' }],
        },
      },
    });

    expect(catalog.version).toBe(3);
    expect(catalog.specialties.cirugia.items).toEqual([
      expect.objectContaining({ text: 'Control en policlínico', source: 'custom' }),
    ]);
  });

  it('removes inherited default phrases from Cir even if they still exist in Firebase', () => {
    const catalog = normalizeClinicalDocumentIndicationsCatalog({
      version: 3,
      specialties: {
        cirugia: {
          id: 'cirugia',
          label: 'Cir',
          items: [
            { id: 'cirugia-reposo-absoluto', text: 'Reposo Absoluto', source: 'default' },
            { id: 'custom-2', text: 'Control en policlínico de cirugía', source: 'custom' },
          ],
        },
      },
    });

    expect(catalog.specialties.cirugia.items).toEqual([
      expect.objectContaining({ text: 'Control en policlínico de cirugía', source: 'custom' }),
    ]);
  });

  it('migrates legacy Cirugía & TMT entries into both separated specialties', () => {
    const legacyCatalog: Parameters<typeof normalizeClinicalDocumentIndicationsCatalog>[0] = {
      version: 1,
      specialties: {
        cirugia_tmt: {
          id: 'cirugia_tmt' as never,
          label: 'Cirugía & TMT',
          items: [{ id: 'legacy-1', text: 'Control con traumatología', source: 'custom' }],
        },
      },
    } as never;

    const catalog = normalizeClinicalDocumentIndicationsCatalog(legacyCatalog);

    expect(catalog.specialties.cirugia.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Control con traumatología', source: 'custom' }),
      ])
    );
    expect(catalog.specialties.tmt.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Control con traumatología', source: 'custom' }),
      ])
    );
  });

  it('persists a custom indication into the selected specialty', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({
        version: 1,
        updatedAt: '2026-03-09T09:00:00.000Z',
        specialties: {},
      }),
    } as unknown as FirestoreDocResult);

    const catalog = await addClinicalDocumentIndicationCatalogItem({
      hospitalId: 'hhr',
      specialtyId: 'psiquiatria',
      text: 'Control con equipo tratante',
    });

    expect(setDoc).toHaveBeenCalled();
    expect(catalog.specialties.psiquiatria.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Control con equipo tratante', source: 'custom' }),
      ])
    );
  });

  it('updates and deletes an existing indication', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => getDefaultClinicalDocumentIndicationsCatalog('2026-03-09T09:00:00.000Z'),
    } as unknown as FirestoreDocResult);

    const updated = await updateClinicalDocumentIndicationCatalogItem({
      hospitalId: 'hhr',
      specialtyId: 'tmt',
      itemId: 'tmt-reposo-absoluto',
      text: 'Reposo en domicilio',
    });

    expect(updated.specialties.tmt.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ text: 'Reposo en domicilio' })])
    );

    const deleted = await deleteClinicalDocumentIndicationCatalogItem({
      hospitalId: 'hhr',
      specialtyId: 'tmt',
      itemId: 'tmt-reposo-relativo',
    });

    expect(deleted.specialties.tmt.items.some(item => item.id === 'tmt-reposo-relativo')).toBe(
      false
    );
  });
});
