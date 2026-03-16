import { db } from '@/firebaseConfig';
import {
  doc,
  getDoc,
  setDoc,
  writeBatch,
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  where,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { MasterPatient } from '@/types/domain/clinical';
import { getActiveHospitalId, HOSPITAL_COLLECTIONS } from '@/constants/firestorePaths';
import {
  createBulkUpsertPatientsCommand,
  createUpsertPatientCommand,
  normalizeMasterPatientRut,
  normalizePatientSearchTerm,
  sanitizePatientQueryLimit,
} from '@/services/repositories/contracts/patientMasterContracts';
import { logger } from '@/services/utils/loggerService';

const COLLECTION_NAME = HOSPITAL_COLLECTIONS.PATIENTS;
const patientMasterRepositoryLogger = logger.child('PatientMasterRepository');

/**
 * Normalizes RUT for use as Document ID
 * Ensures consistent format (12.345.678-9) or clean format (12345678-9)
 * We chose formatted RUT for readability in Console
 */
const getCollectionPath = (): string => {
  const hospitalId = getActiveHospitalId();
  return `hospitals/${hospitalId}/${COLLECTION_NAME}`;
};

/**
 * Retrieves a patient from the master index by RUT
 */
export const getPatientByRut = async (rut: string): Promise<MasterPatient | null> => {
  const normalizedRut = normalizeMasterPatientRut(rut);
  if (!normalizedRut) return null;

  const path = getCollectionPath();
  const docRef = doc(db, path, normalizedRut);

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as MasterPatient;
    }
  } catch (err) {
    patientMasterRepositoryLogger.error(`Error fetching patient ${normalizedRut}`, err);
  }
  return null;
};

/**
 * Creates or updates a patient in the master index
 * Uses merge: true to preserve existing fields not present in partial update
 */
export const upsertPatient = async (
  patient: Partial<MasterPatient> & { rut: string }
): Promise<void> => {
  const command = createUpsertPatientCommand(patient);
  if (!command) {
    patientMasterRepositoryLogger.warn(`Invalid RUT for upsert: ${patient.rut}`);
    return;
  }

  const path = getCollectionPath();
  const docRef = doc(db, path, command.rut);

  const now = Date.now();

  const dataToSave: Partial<MasterPatient> & { updatedAt: number } = {
    ...command,
    rut: command.rut, // Ensure ID format matches field
    updatedAt: now,
  };

  // If creating new, set createdAt (using serverTimestamp for consistency or local if preferred)
  // Since merge doesn't support "set only if new" mixed with update easily, we rely on existing check or just overwrite
  // But to keep createdAt stable, we might need check.
  // Optimization: Just set updatedAt. If we want createdAt, we can use a simpler approach:
  // If it's a migration, use provided createdAt.

  if (!patient.createdAt) {
    // We don't overwrite createdAt if it exists, but setDoc merge doesn't do "setOnInsert".
    // Use Javascript logical merge if needed, but for now assuming client doesn't care much about precise creation time of index record
    // or we check existence. checking existence is extra cost.
    // Let's just set updatedAt.
  }

  try {
    await setDoc(docRef, dataToSave, { merge: true });
  } catch (err) {
    patientMasterRepositoryLogger.error(`Error upserting patient ${command.rut}`, err);
  }
};

/**
 * Batch imports patients for migration tools
 */
export const bulkUpsertPatients = async (
  patients: MasterPatient[]
): Promise<{ successes: number; errors: number }> => {
  const normalizedPatients = createBulkUpsertPatientsCommand(patients);
  const path = getCollectionPath();
  const batchSize = 400; // Limit is 500
  let successes = 0;
  let errors = patients.length - normalizedPatients.length;

  for (let i = 0; i < normalizedPatients.length; i += batchSize) {
    const chunk = normalizedPatients.slice(i, i + batchSize);
    const batch = writeBatch(db);

    chunk.forEach(p => {
      const docRef = doc(db, path, p.rut);
      batch.set(docRef, { ...p, rut: p.rut }, { merge: true });
    });

    try {
      await batch.commit();
      successes += chunk.length;
    } catch (err) {
      patientMasterRepositoryLogger.error('Patient batch commit failed', err);
      errors += chunk.length;
    }
  }

  return { successes, errors };
};

/**
 * Retrieves all patients from the master index (Limited to 1000 for safety)
 */
export const getAllPatients = async (): Promise<MasterPatient[]> => {
  const path = getCollectionPath();
  try {
    const q = query(collection(db, path), orderBy('updatedAt', 'desc'), limit(1000));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as MasterPatient);
  } catch (err) {
    patientMasterRepositoryLogger.error('Error fetching all patients', err);
    return [];
  }
};

/**
 * Retrieves a paginated list of patients
 */
export const getPatientsPaginated = async (
  limitCount: number = 20,
  lastDoc?: QueryDocumentSnapshot<DocumentData>
): Promise<{ patients: MasterPatient[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> => {
  const safeLimit = sanitizePatientQueryLimit(limitCount);
  const path = getCollectionPath();
  try {
    let q = query(collection(db, path), orderBy('updatedAt', 'desc'), limit(safeLimit));

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snap = await getDocs(q);
    const patients = snap.docs.map(d => d.data() as MasterPatient);
    const last = snap.docs[snap.docs.length - 1] || null;

    return { patients, lastDoc: last };
  } catch (err) {
    patientMasterRepositoryLogger.error('Error fetching paginated patients', err);
    return { patients: [], lastDoc: null };
  }
};

/**
 * Searches for patients by RUT or Name (limited results)
 */
export const searchPatients = async (
  searchTerm: string,
  limitCount: number = 20
): Promise<MasterPatient[]> => {
  const normalizedTerm = normalizePatientSearchTerm(searchTerm);
  const safeLimit = sanitizePatientQueryLimit(limitCount);
  if (!normalizedTerm || normalizedTerm.length < 2) return [];

  const path = getCollectionPath();
  try {
    // 1. Try Exact match by RUT first
    const patient = await getPatientByRut(normalizedTerm);
    if (patient) {
      return [patient];
    }

    // 2. Try simple search by Full Name (requires indexing in Firestore)
    // Since Firestore doesn't support partial text matches without third party tools,
    // we use a prefix search if possible, or just fetch more and filter.
    // For the hospital context, we'll use a prefix query on fullName.
    const q = query(
      collection(db, path),
      orderBy('fullName'),
      where('fullName', '>=', normalizedTerm),
      where('fullName', '<=', normalizedTerm + '\uf8ff'),
      limit(safeLimit)
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as MasterPatient);
  } catch (err) {
    patientMasterRepositoryLogger.error(`Error searching patients for "${normalizedTerm}"`, err);
    return [];
  }
};

export const PatientMasterRepository = {
  getPatientByRut,
  upsertPatient,
  bulkUpsertPatients,
  getAllPatients,
  getPatientsPaginated,
  searchPatients,
};
