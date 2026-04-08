/**
 * @module labFirestoreService
 * @description Firestore persistence for parsed laboratory results.
 *
 * Stores lab results at `hospitals/{hospitalId}/labResults/{normalizedRut}`.
 * Each document contains all parsed exams for a patient, keyed by exam ID.
 * Uses `setDoc` with `merge: true` to allow incremental updates.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getLabResultsPath } from '@/constants/firestorePaths';
import { createScopedLogger } from '@/services/utils/loggerScope';
import { defaultRepositoryFirestoreRuntime } from '@/services/repositories/repositoryFirestoreRuntime';
import type { LabResultRow, SyslabExamItem, SyslabExamDetail } from '@/types/domain/laboratory';

const logger = createScopedLogger('labFirestoreService');

/** Stored exam record in Firestore. */
export interface StoredLabExam {
  date: string;
  time: string;
  findings: LabResultRow[];
  parsedAt: string;
}

/** Full lab results document for a patient. */
export interface LabResultsDocument {
  rut: string;
  patientName: string;
  lastUpdated: number;
  exams: Record<string, StoredLabExam>;
}

/** Normalize RUT for use as Firestore document ID. */
const normalizeRutForDocId = (rut: string): string => rut.replace(/\./g, '').trim();

const getDb = () => defaultRepositoryFirestoreRuntime.getDb();

/**
 * Save parsed lab exam results to Firestore.
 * Merges new exams into the existing patient document.
 *
 * @param rut - Patient RUT.
 * @param patientName - Patient name for display.
 * @param details - Parsed exam details from the Express server.
 * @param examList - Original exam list (for date/time metadata).
 */
export const saveLabResults = async (
  rut: string,
  patientName: string,
  details: SyslabExamDetail[],
  examList: SyslabExamItem[]
): Promise<void> => {
  try {
    const docId = normalizeRutForDocId(rut);
    const path = getLabResultsPath();
    const docRef = doc(getDb(), path, docId);

    const exams: Record<string, StoredLabExam> = {};
    for (const detail of details) {
      const exam = examList.find(e => e.link === detail.url);
      if (!exam || detail.findings.length === 0) continue;

      exams[exam.id] = {
        date: exam.date,
        time: exam.time,
        findings: detail.findings,
        parsedAt: new Date().toISOString(),
      };
    }

    if (Object.keys(exams).length === 0) return;

    await setDoc(
      docRef,
      {
        rut: docId,
        patientName,
        lastUpdated: Date.now(),
        exams,
      },
      { merge: true }
    );

    logger.info(`Saved ${Object.keys(exams).length} lab exams for ${docId}`);
  } catch (error) {
    logger.error('Failed to save lab results to Firestore', error);
    // Don't throw — persistence failure shouldn't block the UI
  }
};

/**
 * Load previously saved lab results from Firestore.
 *
 * @param rut - Patient RUT.
 * @returns The stored document, or `null` if not found.
 */
export const getLabResults = async (rut: string): Promise<LabResultsDocument | null> => {
  try {
    const docId = normalizeRutForDocId(rut);
    const path = getLabResultsPath();
    const docRef = doc(getDb(), path, docId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const raw = snap.data();
    // Basic shape validation
    if (!raw || typeof raw.rut !== 'string' || typeof raw.exams !== 'object') {
      logger.warn(`Invalid lab results document for ${docId}`);
      return null;
    }
    return raw as LabResultsDocument;
  } catch (error) {
    logger.error('Failed to load lab results from Firestore', error);
    return null;
  }
};
