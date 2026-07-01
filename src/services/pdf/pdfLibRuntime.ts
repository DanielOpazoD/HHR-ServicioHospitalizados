let pdfLibRuntimePromise: Promise<typeof import('pdf-lib')> | null = null;

export const loadPdfLibGenerationRuntime = (): Promise<typeof import('pdf-lib')> => {
  pdfLibRuntimePromise ??= import('pdf-lib');
  return pdfLibRuntimePromise;
};
