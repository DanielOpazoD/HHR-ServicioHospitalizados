/**
 * Persistence shape for the UPC checklist stored inside PatientData.
 *
 * Arrays (not Sets) because Firestore serializes them natively.
 * `classification` is derived from the criteria but stored explicitly
 * so downstream consumers don't need the classification function.
 */
export interface UpcChecklistAuditActor {
  readonly uid: string;
  readonly displayName: string;
}

export interface UpcChecklistRecord {
  /** UCI criterion IDs that were checked (e.g. ['uci_vmi']) */
  readonly uciCriteria: string[];
  /** UTI criterion IDs that were checked (e.g. ['uti_sepsis']) */
  readonly utiCriteria: string[];
  /** Resolved classification: 'UPC_UCI' | 'UPC_UTI' | null */
  readonly classification: 'UPC_UCI' | 'UPC_UTI' | null;
  /** ISO timestamp of the last evaluation */
  readonly evaluatedAt: string;
  /** User who performed the evaluation (audit trail). */
  readonly evaluatedBy?: UpcChecklistAuditActor;
}

export const EMPTY_UPC_CHECKLIST: UpcChecklistRecord = {
  uciCriteria: [],
  utiCriteria: [],
  classification: null,
  evaluatedAt: '',
};
