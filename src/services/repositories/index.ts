// Keep this barrel intentionally explicit to avoid accidental repository API growth.
export * as DailyRecordRepository from './DailyRecordRepository';
export { CatalogRepository } from './CatalogRepository';
export { ClinicalDocumentRepository } from './ClinicalDocumentRepository';
export { ClinicalDocumentTemplateRepository } from './ClinicalDocumentTemplateRepository';
export { PatientMasterRepository } from './PatientMasterRepository';
export { migrateFromDailyRecords } from './patientMasterMigration';
export {
  bridgeLegacyRecordsRange,
  getLegacyBridgeGovernanceSummary,
  getLegacyBridgeUsageSummary,
  listRecentLegacyBridgeOperations,
} from './legacyRecordBridgeService';
