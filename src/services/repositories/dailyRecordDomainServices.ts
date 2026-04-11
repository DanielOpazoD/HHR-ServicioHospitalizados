export {
  addClinicalFhirPatchesForTouchedBeds,
  assignCarriedPatientToRecord,
  buildClinicalBedsFromPreviousRecord,
  buildEmptyClinicalBeds,
  collectDailyRecordPatientsForMasterSync,
  enrichInitializationRecordFromCopySource,
  isSpecialistScopedDailyRecordPatch,
  preserveCIE10FromPreviousDay,
  preparePatientForCarryover,
  syncDailyRecordClinicalResources,
  syncPatientFhirResource,
} from '@/services/repositories/dailyRecordClinicalDomainService';
export {
  inheritPatientHandoffNotes,
  resolveInitialDayHandoff,
} from '@/services/repositories/dailyRecordHandoffDomainService';
export {
  createRecordDateTimestamp,
  ensureDailyRecordDateTimestamp,
  touchDailyRecordLastUpdated,
} from '@/services/repositories/dailyRecordMetadataDomainService';
export { createEmptyDailyRecordMovements } from '@/services/repositories/dailyRecordMovementsDomainService';
export {
  resolveInheritedDailyRecordStaffing,
  type InheritedDailyRecordStaffing,
} from '@/services/repositories/dailyRecordStaffingDomainService';
