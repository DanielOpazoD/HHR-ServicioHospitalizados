import { createScopedLoggerMap } from '@/services/utils/loggerScope';

export const { pdfStorageLogger, pdfContentBuilderLogger } = createScopedLoggerMap({
  pdfStorageLogger: 'PdfStorage',
  pdfContentBuilderLogger: 'PdfContentBuilder',
});
