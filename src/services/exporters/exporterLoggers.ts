import { createScopedLoggerMap } from '@/services/utils/loggerScope';

export const {
  censusMasterExportLogger,
  exportServiceLogger,
  excelFileDownloadLogger,
  jsonImportLogger,
} = createScopedLoggerMap({
  censusMasterExportLogger: 'CensusMasterExport',
  exportServiceLogger: 'ExportService',
  excelFileDownloadLogger: 'ExcelFileDownload',
  jsonImportLogger: 'JsonImport',
});
