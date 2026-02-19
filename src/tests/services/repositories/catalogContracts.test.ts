import {
  normalizeProfessionalCatalog,
  normalizeStringCatalog,
} from '@/services/repositories/contracts/catalogContracts';
import { describe, expect, it } from 'vitest';

describe('catalogContracts', () => {
  it('normalizes string catalogs removing empty/duplicates', () => {
    const result = normalizeStringCatalog([' Ana ', '', 'Pedro', 'Ana', null]);

    expect(result).toEqual(['Ana', 'Pedro']);
  });

  it('normalizes professionals and filters invalid entries', () => {
    const result = normalizeProfessionalCatalog([
      { name: ' Dra. Ana ', phone: ' 123 ', specialty: 'medico', period: ' Semanal ' },
      { name: 'Dra. Ana', phone: '123', specialty: 'medicina interna' },
      { name: 'Sin Especialidad', phone: '999' },
      { name: '', specialty: 'ginecobstetricia', phone: '777' },
      null,
    ]);

    expect(result).toEqual([
      {
        name: 'Dra. Ana',
        phone: '123',
        specialty: 'Medicina Interna',
        period: 'Semanal',
        lastUsed: undefined,
      },
    ]);
  });
});
