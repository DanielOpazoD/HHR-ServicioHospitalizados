// @flake-safe -- setTimeout appears only inside mock contentWindow stubs that synchronously invoke their callback; no real timers.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const callableMock = vi.fn();
const html2canvasMock = vi.fn();
const buildHtmlMock = vi.fn();
const waitForAssetsMock = vi.fn();
const getFunctionsMock = vi.fn();

vi.mock('@/services/firebase-runtime/functionsRuntime', () => ({
  defaultFunctionsRuntime: {
    getFunctions: (...args: unknown[]) => getFunctionsMock(...args),
  },
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => callableMock),
}));

vi.mock('html2canvas', () => ({
  default: html2canvasMock,
}));

class JsPdfMock {
  static outputBlob = new Blob(['snapshot-pdf'], { type: 'application/pdf' });

  internal = {
    pageSize: {
      getWidth: () => 216,
      getHeight: () => 279,
    },
  };

  addImage = vi.fn();
  addPage = vi.fn();
  output = vi.fn(() => JsPdfMock.outputBlob);
}

vi.mock('jspdf', () => ({
  jsPDF: JsPdfMock,
}));

vi.mock('@/features/clinical-documents/services/clinicalDocumentPrintHtmlBuilder', () => ({
  buildClinicalDocumentPrintHtml: buildHtmlMock,
}));

vi.mock('@/features/clinical-documents/services/clinicalDocumentPrintSupport', () => ({
  CLINICAL_DOCUMENT_SHEET_ID: 'clinical-document-sheet',
  waitForClinicalDocumentSheetAssets: waitForAssetsMock,
}));

vi.mock('@/features/clinical-documents/services/clinicalDocumentLoggers', () => ({
  clinicalDocumentPdfRenderLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('clinicalDocumentPdfRenderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFunctionsMock.mockResolvedValue({});
    buildHtmlMock.mockResolvedValue('<div id="clinical-document-sheet">Hoja</div>');
    callableMock.mockResolvedValue({
      data: {
        contentBase64: 'UERG',
        mimeType: 'application/pdf',
      },
    });
    html2canvasMock.mockResolvedValue({
      width: 1200,
      height: 1800,
      toDataURL: () => 'data:image/png;base64,abc',
    });
  });

  it('returns null when printable html is unavailable', async () => {
    buildHtmlMock.mockResolvedValue(null);
    const { generateClinicalDocumentPrintStyledPdfBlob } =
      await import('@/features/clinical-documents/services/clinicalDocumentPdfRenderService');

    await expect(generateClinicalDocumentPrintStyledPdfBlob()).resolves.toBeNull();
  });

  it('uses backend rendering when the cloud renderer succeeds', async () => {
    const { generateClinicalDocumentPrintStyledPdfBlob } =
      await import('@/features/clinical-documents/services/clinicalDocumentPdfRenderService');

    const result = await generateClinicalDocumentPrintStyledPdfBlob();

    expect(callableMock).toHaveBeenCalledWith({
      html: '<div id="clinical-document-sheet">Hoja</div>',
    });
    expect(result).toBeInstanceOf(Blob);
    expect(result?.type).toBe('application/pdf');
    expect(html2canvasMock).not.toHaveBeenCalled();
  });

  it('forwards patient signature visibility to printable html generation', async () => {
    const { generateClinicalDocumentPrintStyledPdfBlob } =
      await import('@/features/clinical-documents/services/clinicalDocumentPdfRenderService');

    await generateClinicalDocumentPrintStyledPdfBlob({
      documentType: 'epicrisis',
      title: 'Epicrisis médica',
      includePatientSignature: false,
    } as never);

    expect(buildHtmlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        includePatientSignature: false,
      })
    );
  });

  it('falls back to client snapshot rendering when backend rendering fails', async () => {
    callableMock.mockRejectedValueOnce(new Error('backend unavailable'));
    const originalCreateElement = document.createElement.bind(document);
    const fakeSheet = document.createElement('div');
    fakeSheet.id = 'clinical-document-sheet';
    const fakeFrameDocument = {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
      readyState: 'complete',
      getElementById: vi.fn((id: string) => (id === 'clinical-document-sheet' ? fakeSheet : null)),
    } as unknown as Document;
    const fakeIframe = originalCreateElement('iframe');
    Object.defineProperty(fakeIframe, 'contentDocument', {
      configurable: true,
      value: fakeFrameDocument,
    });
    Object.defineProperty(fakeIframe, 'contentWindow', {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        setTimeout: (callback: () => void) => {
          callback();
          return 0;
        },
      },
    });
    const removeSpy = vi.spyOn(fakeIframe, 'remove').mockImplementation(() => {});
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string) =>
        tagName === 'iframe'
          ? fakeIframe
          : originalCreateElement(tagName)) as typeof document.createElement);
    const { generateClinicalDocumentPrintStyledPdfBlob } =
      await import('@/features/clinical-documents/services/clinicalDocumentPdfRenderService');

    const result = await generateClinicalDocumentPrintStyledPdfBlob();
    createElementSpy.mockRestore();
    removeSpy.mockRestore();

    expect(waitForAssetsMock).toHaveBeenCalled();
    expect(html2canvasMock).toHaveBeenCalled();
    expect(result).toBeInstanceOf(Blob);
    expect(result?.type).toBe('application/pdf');
  });

  it('falls back to client snapshot rendering when backend returns malformed payload', async () => {
    callableMock.mockResolvedValueOnce({
      data: {
        mimeType: 'application/pdf',
      },
    });
    const originalCreateElement = document.createElement.bind(document);
    const fakeSheet = document.createElement('div');
    fakeSheet.id = 'clinical-document-sheet';
    const fakeFrameDocument = {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
      readyState: 'complete',
      getElementById: vi.fn((id: string) => (id === 'clinical-document-sheet' ? fakeSheet : null)),
    } as unknown as Document;
    const fakeIframe = originalCreateElement('iframe');
    Object.defineProperty(fakeIframe, 'contentDocument', {
      configurable: true,
      value: fakeFrameDocument,
    });
    Object.defineProperty(fakeIframe, 'contentWindow', {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        setTimeout: (callback: () => void) => {
          callback();
          return 0;
        },
      },
    });
    const removeSpy = vi.spyOn(fakeIframe, 'remove').mockImplementation(() => {});
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string) =>
        tagName === 'iframe'
          ? fakeIframe
          : originalCreateElement(tagName)) as typeof document.createElement);
    const { generateClinicalDocumentPrintStyledPdfBlob } =
      await import('@/features/clinical-documents/services/clinicalDocumentPdfRenderService');

    const result = await generateClinicalDocumentPrintStyledPdfBlob();
    createElementSpy.mockRestore();
    removeSpy.mockRestore();

    expect(waitForAssetsMock).toHaveBeenCalled();
    expect(html2canvasMock).toHaveBeenCalled();
    expect(result).toBeInstanceOf(Blob);
  });

  it('supports injected functions runtimes for backend rendering', async () => {
    const { createClinicalDocumentPdfRenderService } =
      await import('@/features/clinical-documents/services/clinicalDocumentPdfRenderService');

    const service = createClinicalDocumentPdfRenderService({
      getFunctions: vi.fn().mockResolvedValue({ custom: true } as never),
    });

    await service.generateClinicalDocumentPrintStyledPdfBlob();

    expect(getFunctionsMock).not.toHaveBeenCalled();
    expect(callableMock).toHaveBeenCalledWith({
      html: '<div id="clinical-document-sheet">Hoja</div>',
    });
  });
});
