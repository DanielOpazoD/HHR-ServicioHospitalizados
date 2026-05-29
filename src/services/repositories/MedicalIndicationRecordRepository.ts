import { getActiveHospitalId, getMedicalIndicationRecordsPath } from '@/constants/firestorePaths';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { firestoreDb } from '@/services/storage/firestore';
import type { MedicalIndicationRecord } from '@/shared/contracts/medicalIndications';

export const MedicalIndicationRecordRepository = {
  async listByEpisodeAndTargetDate(
    episodeId: string,
    targetDate: string,
    hospitalId: string = getActiveHospitalId()
  ): Promise<MedicalIndicationRecord[]> {
    if (!isFirestoreEnabled() || !episodeId.trim() || !targetDate.trim()) return [];

    const documents = await firestoreDb.getDocs<MedicalIndicationRecord>(
      getMedicalIndicationRecordsPath(hospitalId),
      {
        where: [
          { field: 'episodeId', operator: '==', value: episodeId },
          { field: 'targetDate', operator: '==', value: targetDate },
        ],
      }
    );

    return [...documents].sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
  },

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
