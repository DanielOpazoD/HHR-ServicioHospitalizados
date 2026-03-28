import { createScopedLogger } from '@/services/utils/loggerScope';

export const censusMasterExportLogger = createScopedLogger('CensusMasterExport');
export const exportServiceLogger = createScopedLogger('ExportService');
export const excelFileDownloadLogger = createScopedLogger('ExcelFileDownload');
export const jsonImportLogger = createScopedLogger('JsonImport');
