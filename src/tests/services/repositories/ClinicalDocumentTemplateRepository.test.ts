import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/storage/firestore', () => ({
  firestoreDb: {
    getDocs: vi.fn(),
    runBatch: vi.fn(),
    setDoc: vi.fn(),
  },
}));

vi.mock('@/services/repositories/repositoryConfig', () => ({
  isFirestoreEnabled: vi.fn(() => true),
}));

import { firestoreDb } from '@/services/storage/firestore';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { ClinicalDocumentTemplateRepository } from '@/services/repositories/ClinicalDocumentTemplateRepository';

describe('ClinicalDocumentTemplateRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isFirestoreEnabled).mockReturnValue(true);
  });

  it('uses default templates without querying or seeding Firestore when disabled', async () => {
    vi.mocked(isFirestoreEnabled).mockReturnValue(false);

    const templates = await ClinicalDocumentTemplateRepository.listActive('hhr');
    await ClinicalDocumentTemplateRepository.seedDefaults('hhr');
    await ClinicalDocumentTemplateRepository.save(templates[0], 'hhr');

    expect(templates.length).toBeGreaterThan(0);
    expect(firestoreDb.getDocs).not.toHaveBeenCalled();
    expect(firestoreDb.runBatch).not.toHaveBeenCalled();
    expect(firestoreDb.setDoc).not.toHaveBeenCalled();
  });
});
