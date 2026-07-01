let pdfJsTextRuntimePromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null =
  null;

export const loadPdfJsTextRuntime = async (): Promise<
  typeof import('pdfjs-dist/legacy/build/pdf.mjs')
> => {
  pdfJsTextRuntimePromise ??= import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfjs = await pdfJsTextRuntimePromise;
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.mjs',
    import.meta.url
  ).toString();
  return pdfjs;
};
