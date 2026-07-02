let pdfLibRuntimePromise: Promise<typeof import('pdf-lib')> | null = null;

const resolvePdfLibGenerationRuntime = (): Promise<typeof import('pdf-lib')> => import('pdf-lib');

export const loadPdfLibGenerationRuntime = async (): Promise<typeof import('pdf-lib')> => {
  try {
    pdfLibRuntimePromise ??= resolvePdfLibGenerationRuntime();
    return await pdfLibRuntimePromise;
  } catch (error) {
    pdfLibRuntimePromise = null;
    throw error;
  }
};
