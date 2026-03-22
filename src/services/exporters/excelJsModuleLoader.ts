interface ExcelJSModuleType {
  Workbook: typeof import('exceljs').Workbook;
  default?:
    | {
        Workbook: typeof import('exceljs').Workbook;
      }
    | typeof import('exceljs').Workbook;
}

const EXCELJS_RUNTIME_SRC = '/vendor/exceljs.min.js';
let browserExcelModulePromise: Promise<ExcelJSModuleType> | null = null;

declare global {
  interface Window {
    ExcelJS?: ExcelJSModuleType;
  }
}

const loadExcelJsFromRuntimeAsset = async (): Promise<ExcelJSModuleType> => {
  if (window.ExcelJS?.Workbook) {
    return window.ExcelJS;
  }

  if (!browserExcelModulePromise) {
    browserExcelModulePromise = new Promise<ExcelJSModuleType>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-hhr-exceljs-runtime="true"]'
      );

      const resolveFromWindow = () => {
        if (window.ExcelJS?.Workbook) {
          resolve(window.ExcelJS);
          return;
        }
        browserExcelModulePromise = null;
        reject(new Error('ExcelJS runtime asset loaded without exposing window.ExcelJS'));
      };

      const rejectLoad = () => {
        browserExcelModulePromise = null;
        reject(new Error('Failed to load ExcelJS runtime asset'));
      };

      if (existingScript) {
        existingScript.addEventListener('load', resolveFromWindow, { once: true });
        existingScript.addEventListener('error', rejectLoad, { once: true });
        if (existingScript.dataset.loaded === 'true') {
          resolveFromWindow();
        }
        return;
      }

      const script = document.createElement('script');
      script.async = true;
      script.src = EXCELJS_RUNTIME_SRC;
      script.dataset.hhrExceljsRuntime = 'true';
      script.addEventListener(
        'load',
        () => {
          script.dataset.loaded = 'true';
          resolveFromWindow();
        },
        { once: true }
      );
      script.addEventListener('error', rejectLoad, { once: true });
      document.head.appendChild(script);
    });
  }

  return browserExcelModulePromise;
};

export const loadExcelJSModule = async (): Promise<ExcelJSModuleType> => {
  if (typeof window === 'undefined') {
    const nodeLoader = await import('@/services/exporters/excelJsModuleLoader.node');
    return nodeLoader.loadExcelJSModule();
  }
  return loadExcelJsFromRuntimeAsset();
};

export const resolveExcelWorkbookConstructor = (
  excelModule: ExcelJSModuleType
): typeof import('exceljs').Workbook => {
  if (excelModule.Workbook) {
    return excelModule.Workbook;
  }

  if (excelModule.default && 'Workbook' in excelModule.default) {
    return excelModule.default.Workbook;
  }

  if (typeof excelModule.default === 'object' && excelModule.default !== null) {
    const defaultObj = excelModule.default as { Workbook?: typeof import('exceljs').Workbook };
    if (defaultObj.Workbook) {
      return defaultObj.Workbook;
    }
  }

  throw new Error('ExcelJS runtime asset could not be loaded correctly.');
};
