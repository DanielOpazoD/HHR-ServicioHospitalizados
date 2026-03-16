import { PatientMasterRepository } from '@/services/repositories/PatientMasterRepository';
import type { MasterPatient } from '@/types/domain/clinical';

export interface PatientMasterWritePort {
  bulkUpsertPatients: (patients: MasterPatient[]) => Promise<{
    successes: number;
    errors: number;
  }>;
}

export const defaultPatientMasterWritePort: PatientMasterWritePort = {
  bulkUpsertPatients: async patients => PatientMasterRepository.bulkUpsertPatients(patients),
};
