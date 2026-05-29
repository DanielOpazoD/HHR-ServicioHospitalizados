import { getActiveHospitalId, getMedicalIndicationRecordsPath } from '@/constants/firestorePaths';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { firestoreDb } from '@/services/storage/firestore';
import type { MedicalIndicationRecord } from '@/shared/contracts/medicalIndications';

export const MedicalIndicationRecordRepository = {
  async create(
    record: MedicalIndicationRecord,
    hospitalId: string = getActiveHospitalId()
  ): Promise<void> {
    if (!isFirestoreEnabled()) {
      throw new Error('Firestore no está disponible para guardar el registro clínico.');
    }

    await firestoreDb.setDoc(getMedicalIndicationRecordsPath(hospitalId), record.id, record);
  },
};
