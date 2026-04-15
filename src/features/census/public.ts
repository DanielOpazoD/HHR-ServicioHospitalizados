// Public API for code outside the census feature. Internal consumers should import local modules directly.
export { CensusView } from './components/CensusView';
export { CensusEmailConfigModal } from './components/CensusEmailConfigModal';
export { GlobalPatientSearchModal } from './components/global-search/GlobalPatientSearchModal';
export { useGlobalPatientSearch } from './components/global-search/useGlobalPatientSearch';
export type { CensusAccessProfile } from './types/censusAccessProfile';
export { isSpecialistCensusAccessProfile } from './types/censusAccessProfile';
export type {
  ClinicalDocSummary,
  EpisodeDocuments,
  SelectedPatientDetail,
  UseGlobalPatientSearchReturn,
} from './components/global-search/globalSearchContracts';
export {
  resolveAdmissionsCountForRecord,
  resolveMovementSummaryState,
  resolveStaffSelectorsClassName,
  resolveStaffSelectorsState,
} from './controllers/censusStaffHeaderController';
export * from './controllers/bedManagerGridItemsController';
export * from './controllers/bedManagerModalController';
export * from './controllers/censusEmailRecipientsController';
export * from './controllers/dischargeModalController';
export * from './controllers/patientMovementCreationController';
export * from './controllers/patientMovementCreationErrorPresentation';
export * from './controllers/patientMovementCreationInputController';
export * from './controllers/patientMovementMutationController';
export * from './controllers/patientMovementRuntimeController';
export * from './controllers/patientMovementSelectionController';
export * from './controllers/patientMovementUndoController';
export * from './controllers/patientMovementUndoErrorPresentation';
export * from './controllers/patientMovementUndoMutationController';
export * from './controllers/transferModalController';
