import type { MasterPatient } from '@/types/domain/patientMaster';

let patientMasterRepositoryPromise: Promise<
  Pick<typeof import('@/services/repositories/PatientMasterRepository'), 'searchPatients'>
> | null = null;

const loadPatientMasterRepository = () => {
  patientMasterRepositoryPromise ??= import('@/services/repositories/PatientMasterRepository');
  return patientMasterRepositoryPromise;
};

export const searchMasterPatients = async (
  searchTerm: string,
  limitCount: number = 20
): Promise<MasterPatient[]> => {
  const trimmed = searchTerm.trim();
  if (!trimmed) return [];

  const repository = await loadPatientMasterRepository();
  return repository.searchPatients(trimmed, limitCount);
};
