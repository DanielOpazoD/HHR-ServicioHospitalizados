import { collection, doc, getDoc, getDocs, query, where, type Firestore } from 'firebase/firestore';
import type { ClinicalDocumentRecord } from '../../../src/domain/clinical-documents/entities';
import {
  buildClinicalAISummaryContext,
  type ClinicalAISummaryContext,
} from '../../../src/application/ai/clinicalSummaryContextUseCase';
import type { DailyRecord } from '../../../src/types/domain/dailyRecord';

const DEFAULT_HOSPITAL_ID = 'hanga_roa';

const sortDocuments = (documents: ClinicalDocumentRecord[]): ClinicalDocumentRecord[] =>
  [...documents].sort((left, right) => right.audit.updatedAt.localeCompare(left.audit.updatedAt));

export interface LoadClinicalAIContextParams {
  db: Firestore;
  recordDate: string;
  bedId: string;
  hospitalId?: string;
}

export const loadClinicalAIContextFromFirestore = async ({
  db,
  recordDate,
  bedId,
  hospitalId = DEFAULT_HOSPITAL_ID,
}: LoadClinicalAIContextParams): Promise<ClinicalAISummaryContext> => {
  const recordRef = doc(db, `hospitals/${hospitalId}/dailyRecords`, recordDate);
  const recordSnap = await getDoc(recordRef);

  if (!recordSnap.exists()) {
    throw new Error(`Daily record '${recordDate}' not found.`);
  }

  const record = recordSnap.data() as DailyRecord;
  const patient = record.beds?.[bedId];

  if (!patient?.patientName) {
    throw new Error(`Patient not found in bed '${bedId}' for '${recordDate}'.`);
  }

  const episodeKey = `${patient.rut || 'sin-rut'}__${patient.admissionDate || 'sin-ingreso'}`;
  const documentsQuery = query(
    collection(db, `hospitals/${hospitalId}/clinicalDocuments`),
    where('episodeKey', '==', episodeKey)
  );
  const documentsSnap = await getDocs(documentsQuery);
  const documents = sortDocuments(
    documentsSnap.docs.map(snapshot => snapshot.data() as ClinicalDocumentRecord)
  );

  return buildClinicalAISummaryContext({
    record,
    bedId,
    documents,
  });
};
