import { describe, expect, it } from 'vitest';

import {
  assertClinicalDocumentDefinitionRegistryIntegrity,
  getClinicalDocumentDefinitionRegistryIntegrity,
} from '@/features/clinical-documents/domain/definitions';

describe('clinicalDocumentDefinitionRegistry', () => {
  it('has a valid definition for every supported document type', () => {
    const integrity = getClinicalDocumentDefinitionRegistryIntegrity();

    expect(integrity.ok).toBe(true);
    expect(integrity.missingTypes).toEqual([]);
    expect(integrity.invalidPrintTypes).toEqual([]);
    expect(() => assertClinicalDocumentDefinitionRegistryIntegrity()).not.toThrow();
  });
});
