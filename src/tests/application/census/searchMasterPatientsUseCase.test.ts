import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockSearchPatients = vi.fn();

vi.mock('@/services/repositories/PatientMasterRepository', () => ({
  searchPatients: (...args: unknown[]) => mockSearchPatients(...args),
}));

import { searchMasterPatients } from '@/application/census/searchMasterPatientsUseCase';

describe('searchMasterPatientsUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty results for whitespace-only queries without calling the repository', async () => {
    await expect(searchMasterPatients('   ')).resolves.toEqual([]);
    expect(mockSearchPatients).not.toHaveBeenCalled();
  });

  it('forwards a trimmed query and explicit limit to the repository', async () => {
    mockSearchPatients.mockResolvedValueOnce([
      { rut: '1-9', fullName: 'Paciente', createdAt: 1, updatedAt: 1 },
    ]);

    await searchMasterPatients('  ines leiva  ', 25);

    expect(mockSearchPatients).toHaveBeenCalledWith('ines leiva', 25);
  });

  it('uses the default limit when no limit is provided', async () => {
    mockSearchPatients.mockResolvedValueOnce([]);

    await searchMasterPatients('ines');

    expect(mockSearchPatients).toHaveBeenCalledWith('ines', 20);
  });
});
