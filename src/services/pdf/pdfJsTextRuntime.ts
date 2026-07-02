let pdfJsTextRuntimePromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null =
  null;

const resolvePdfJsTextRuntime = async (): Promise<
  typeof import('pdfjs-dist/legacy/build/pdf.mjs')
> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.mjs',
    import.meta.url
  ).toString();
  return pdfjs;
};

export const loadPdfJsTextRuntime = async (): Promise<
  typeof import('pdfjs-dist/legacy/build/pdf.mjs')
> => {
  try {
    pdfJsTextRuntimePromise ??= resolvePdfJsTextRuntime();
    return await pdfJsTextRuntimePromise;
  } catch (error) {
    pdfJsTextRuntimePromise = null;
    throw error;
  }
};
