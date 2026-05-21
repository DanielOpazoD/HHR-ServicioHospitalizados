import { getActiveHospitalId } from '@/constants/firestorePaths';
import {
  buildClinicalAttachmentStoragePath,
  parseClinicalAttachmentRecord,
  normalizeClinicalAttachmentRutKey,
  resolveClinicalAttachmentFilePolicy,
  type ClinicalAttachmentFileKind,
  type ClinicalAttachmentRecord,
  type ClinicalDocumentAuditActor,
  type ClinicalDocumentType,
} from '@/features/clinical-documents/internal';
import { firestoreDb, type IDatabaseProvider } from '@/services/storage/firestore';
import {
  defaultClinicalAttachmentStorageRuntime,
  type ClinicalAttachmentStorageRuntime,
} from '@/services/firebase-runtime/clinicalAttachmentRuntime';

const getClinicalAttachmentsCollectionPath = (hospitalId: string = getActiveHospitalId()): string =>
  `hospitals/${hospitalId}/clinicalAttachments`;

const sortClinicalAttachments = (records: ClinicalAttachmentRecord[]): ClinicalAttachmentRecord[] =>
  [...records].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

const filterActiveClinicalAttachments = (records: unknown[]): ClinicalAttachmentRecord[] =>
  sortClinicalAttachments(
    records
      .map(record => {
        try {
          return parseClinicalAttachmentRecord(record);
        } catch {
          return null;
        }
      })
      .filter(
        (record): record is ClinicalAttachmentRecord =>
          record !== null && record.status === 'active'
      )
  );

export interface UploadClinicalAttachmentInput {
  id: string;
  hospitalId?: string;
  patientRut: string;
  patientName?: string;
  episodeKey: string;
  admissionDate?: string;
  sourceDailyRecordDate?: string;
  bedId?: string;
  documentId?: string;
  documentType?: ClinicalDocumentType;
  sectionId?: string;
  file: File;
  displayName?: string;
  actor: ClinicalDocumentAuditActor;
  now: string;
  image?: ClinicalAttachmentRecord['image'];
}

export interface DeleteClinicalAttachmentInput {
  attachmentId: string;
  hospitalId?: string;
  storagePath: string;
  actor: ClinicalDocumentAuditActor;
  now: string;
}

interface ClinicalAttachmentRepositoryDependencies {
  db?: IDatabaseProvider;
  storageRuntime?: ClinicalAttachmentStorageRuntime;
}

export const createClinicalAttachmentRepository = ({
  db = firestoreDb,
  storageRuntime = defaultClinicalAttachmentStorageRuntime,
}: ClinicalAttachmentRepositoryDependencies = {}) => ({
  async upload(input: UploadClinicalAttachmentInput): Promise<ClinicalAttachmentRecord> {
    const hospitalId = input.hospitalId || getActiveHospitalId();
    const filePolicy = resolveClinicalAttachmentFilePolicy(input.file, { source: 'file-picker' });
    if (!filePolicy.fileKind || filePolicy.action === 'rejected') {
      throw new Error(filePolicy.message || 'Archivo de adjunto clinico no permitido.');
    }

    const storagePath = buildClinicalAttachmentStoragePath({
      hospitalId,
      patientRut: input.patientRut,
      episodeKey: input.episodeKey,
      attachmentId: input.id,
      fileName: input.file.name,
    });
    const storage = await storageRuntime.getStorage();
    const storageRef = storageRuntime.ref(storage, storagePath);

    await storageRuntime.uploadBytes(storageRef, input.file, {
      contentType: input.file.type,
      customMetadata: {
        module: 'clinical-attachments',
        hospitalId,
        patientRut: input.patientRut,
        episodeKey: input.episodeKey,
        attachmentId: input.id,
      },
    });

    const downloadUrl = await storageRuntime.getDownloadURL(storageRef);
    const record = parseClinicalAttachmentRecord({
      id: input.id,
      hospitalId,
      patientRut: input.patientRut,
      patientRutKey: normalizeClinicalAttachmentRutKey(input.patientRut),
      patientName: input.patientName,
      episodeKey: input.episodeKey,
      admissionDate: input.admissionDate,
      sourceDailyRecordDate: input.sourceDailyRecordDate,
      bedId: input.bedId,
      documentId: input.documentId,
      documentType: input.documentType,
      sectionId: input.sectionId,
      storagePath,
      downloadUrl,
      originalFileName: input.file.name,
      displayName: input.displayName || input.file.name,
      contentType: input.file.type,
      fileKind: filePolicy.fileKind as ClinicalAttachmentFileKind,
      sizeBytes: input.file.size,
      image: input.image,
      status: 'active',
      createdAt: input.now,
      createdBy: input.actor,
      updatedAt: input.now,
      updatedBy: input.actor,
    });

    try {
      await db.setDoc(getClinicalAttachmentsCollectionPath(hospitalId), input.id, record);
    } catch (error) {
      try {
        await storageRuntime.deleteObject(storageRef);
      } catch {
        // Best-effort cleanup; preserve the original metadata error for callers.
      }
      throw error;
    }

    return record;
  },

  async listByEpisode(
    episodeKey: string,
    hospitalId: string = getActiveHospitalId()
  ): Promise<ClinicalAttachmentRecord[]> {
    const records = await db.getDocs<ClinicalAttachmentRecord>(
      getClinicalAttachmentsCollectionPath(hospitalId),
      {
        where: [{ field: 'episodeKey', operator: '==', value: episodeKey }],
      }
    );
    return filterActiveClinicalAttachments(records);
  },

  async listByPatient(
    patientRut: string,
    hospitalId: string = getActiveHospitalId()
  ): Promise<ClinicalAttachmentRecord[]> {
    const records = await db.getDocs<ClinicalAttachmentRecord>(
      getClinicalAttachmentsCollectionPath(hospitalId),
      {
        where: [
          {
            field: 'patientRutKey',
            operator: '==',
            value: normalizeClinicalAttachmentRutKey(patientRut),
          },
        ],
      }
    );
    return filterActiveClinicalAttachments(records);
  },

  async delete(input: DeleteClinicalAttachmentInput): Promise<void> {
    const hospitalId = input.hospitalId || getActiveHospitalId();
    await db.updateDoc(getClinicalAttachmentsCollectionPath(hospitalId), input.attachmentId, {
      status: 'deleted',
      deletedAt: input.now,
      deletedBy: input.actor,
      updatedAt: input.now,
      updatedBy: input.actor,
    });

    try {
      const storage = await storageRuntime.getStorage();
      await storageRuntime.deleteObject(storageRuntime.ref(storage, input.storagePath));
    } catch {
      // Metadata already hides the attachment; physical cleanup can be retried later.
    }
  },
});

export const ClinicalAttachmentRepository = createClinicalAttachmentRepository();
