/**
 * Canonical Firestore storage entrypoint.
 *
 * New product code should import from this module instead of
 * `@/services/storage/firestoreService`.
 */

export {
  getAvailableDatesFromFirestore,
  getAllRecordsFromFirestore,
  getMonthRecordsFromFirestore,
  getRecordFromFirestore,
  getRecordsRangeFromFirestore,
  isFirestoreAvailable,
  subscribeToRecord,
} from '@/services/storage/firestore/firestoreRecordQueries';

export {
  ConcurrencyError,
  deleteRecordFromFirestore,
  moveRecordToTrash,
  saveRecordToFirestore,
  updateRecordPartial,
} from '@/services/storage/firestore/firestoreRecordWrites';

export {
  getNurseCatalogFromFirestore,
  getProfessionalsCatalogFromFirestore,
  getTensCatalogFromFirestore,
  saveNurseCatalogToFirestore,
  saveProfessionalsCatalogToFirestore,
  saveTensCatalogToFirestore,
  subscribeToNurseCatalog,
  subscribeToProfessionalsCatalog,
  subscribeToTensCatalog,
} from '@/services/storage/firestore/firestoreCatalogService';
