import type { DocumentData, DocumentSnapshot, QueryDocumentSnapshot } from 'firebase/firestore';
import type {
  BackupCreator,
  BackupFile,
  BackupFilePreview,
  BackupFileType,
  BackupShiftType,
} from '@/types/backup';
import {
  formatBackupDisplayDate,
  formatBackupShiftLabel,
} from '@/shared/backup/backupPresentation';

export interface NursingHandoffBackupPayload {
  type: BackupFileType;
  shiftType: BackupShiftType;
  date: string;
  title: string;
  createdAt: unknown;
  createdBy: BackupCreator;
  metadata: {
    deliveryStaff: string;
    receivingStaff: string;
    patientCount: number;
    shiftType: BackupShiftType;
  };
  content: Record<string, unknown>;
}

export const generateBackupId = (date: string, shiftType: BackupShiftType): string =>
  `${date}_${shiftType}`;

export const countPatientsInBackupContent = (content: Record<string, unknown>): number => {
  const beds = (content as { beds?: Record<string, { patientName?: string }> }).beds;
  return beds ? Object.values(beds).filter(bed => bed?.patientName).length : 0;
};

export const formatDateForBackupTitle = (date: string): string => formatBackupDisplayDate(date);

export const buildNursingHandoffBackupPayload = ({
  date,
  shiftType,
  deliveryStaff,
  receivingStaff,
  content,
  createdAt,
  createdBy,
}: {
  date: string;
  shiftType: BackupShiftType;
  deliveryStaff: string;
  receivingStaff: string;
  content: Record<string, unknown>;
  createdAt: unknown;
  createdBy: BackupCreator;
}): NursingHandoffBackupPayload => ({
  type: 'NURSING_HANDOFF',
  shiftType,
  date,
  title: `Entrega de Turno Enfermería - ${formatBackupShiftLabel(shiftType)} - ${formatDateForBackupTitle(date)}`,
  createdAt,
  createdBy,
  metadata: {
    deliveryStaff,
    receivingStaff,
    patientCount: countPatientsInBackupContent(content),
    shiftType,
  },
  content,
});

export const docToBackupPreview = (
  docSnap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>
): BackupFilePreview => {
  const data = docSnap.data();
  if (!data) {
    throw new Error('Document data is undefined');
  }

  return {
    id: docSnap.id,
    type: data.type,
    shiftType: data.shiftType,
    date: data.date,
    title: data.title,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt?.toString(),
    createdBy: data.createdBy,
    metadata: data.metadata,
  };
};

export const docToBackupFile = (
  docSnap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>
): BackupFile => {
  const data = docSnap.data();
  if (!data) {
    throw new Error('Document data is undefined');
  }

  return {
    ...docToBackupPreview(docSnap),
    content: data.content,
  };
};
