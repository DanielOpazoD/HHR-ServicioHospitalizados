import { resolvePrescriptionImageDownloadUrl } from '@/features/prescriptions/services/prescriptionStorageImageService';
import {
  PRESCRIPTION_ASSIGNMENT_SCOPE_LABELS,
  PRESCRIPTION_TYPE_LABELS,
  resolvePrescriptionAssignmentScope,
  type PrescriptionRecord,
} from '@/types/prescriptionTypes';

const PRINT_ROOT_ID = 'prescription-monthly-print-root';
const PRINT_STYLE_ID = 'prescription-monthly-print-style';
const PRINT_TRIGGER_DELAY_MS = 150;
const PRINT_CLEANUP_TIMEOUT_MS = 60_000;
const IMAGE_LOAD_TIMEOUT_MS = 8_000;

export type PrescriptionsPerPageOption = 1 | 2 | 4 | 6;
export type PrescriptionMonthlyPdfColorMode = 'color' | 'grayscale';
export type PrescriptionMonthlyPdfImageQuality = 'medium' | 'reduced' | 'compact' | 'low';

export interface PrescriptionMonthlyPdfOptions {
  prescriptionsPerPage: PrescriptionsPerPageOption;
  colorMode: PrescriptionMonthlyPdfColorMode;
  imageQuality: PrescriptionMonthlyPdfImageQuality;
}

export const DEFAULT_PRESCRIPTION_MONTHLY_PDF_OPTIONS: PrescriptionMonthlyPdfOptions = {
  prescriptionsPerPage: 2,
  colorMode: 'color',
  imageQuality: 'medium',
};

export const PRESCRIPTION_PDF_IMAGE_QUALITY_PRESETS: Record<
  PrescriptionMonthlyPdfImageQuality,
  { width: number; quality: number } | null
> = {
  medium: null,
  reduced: { width: 980, quality: 66 },
  compact: { width: 760, quality: 58 },
  low: { width: 560, quality: 50 },
};

interface MonthlyPrescriptionPdfScope {
  records: PrescriptionRecord[];
  startIso: string;
  endIso: string;
}

interface MonthlyPrescriptionPdfFileNameParams {
  startIso: string;
  endIso: string;
}

interface ExportMonthlyPrescriptionsPdfParams {
  records: PrescriptionRecord[];
  selectedDateIso?: string | null;
  options?: Partial<PrescriptionMonthlyPdfOptions>;
}

export interface ExportMonthlyPrescriptionsPdfResult {
  exportedCount: number;
  fileName: string;
  optimizationFallbackCount: number;
}

interface PrintablePrescriptionImageAsset {
  optimizationFallback: boolean;
  revoke?: () => void;
  url: string;
}

const toLocalIsoDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseIsoDateOrToday = (isoDate?: string | null): Date => {
  if (isoDate) {
    const [year, month, day] = isoDate.split('-').map(Number);
    const parsed = new Date(year, (month || 1) - 1, day || 1);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
};

const parseRecordCreatedAt = (record: PrescriptionRecord): Date | null => {
  const createdAt = new Date(record.createdAt);
  return Number.isNaN(createdAt.getTime()) ? null : createdAt;
};

const hasParsedCreatedAt = (entry: {
  record: PrescriptionRecord;
  createdAt: Date | null;
}): entry is { record: PrescriptionRecord; createdAt: Date } => entry.createdAt !== null;

export const collectMonthlyPrescriptionExport = (
  records: PrescriptionRecord[],
  selectedDateIso?: string | null
): MonthlyPrescriptionPdfScope => {
  const selectedDate = parseIsoDateOrToday(selectedDateIso);
  const selectedYear = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth();
  const startIso = toLocalIsoDay(new Date(selectedYear, selectedMonth, 1));

  const monthlyRecords = records
    .map(record => ({ record, createdAt: parseRecordCreatedAt(record) }))
    .filter(hasParsedCreatedAt)
    .filter(
      entry =>
        entry.createdAt.getFullYear() === selectedYear &&
        entry.createdAt.getMonth() === selectedMonth
    )
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

  const lastAvailableDate =
    monthlyRecords.at(-1)?.createdAt ?? new Date(selectedYear, selectedMonth, 1);

  return {
    records: monthlyRecords.map(entry => entry.record),
    startIso,
    endIso: toLocalIsoDay(lastAvailableDate),
  };
};

export const buildMonthlyPrescriptionPdfFileName = ({
  startIso,
  endIso,
}: MonthlyPrescriptionPdfFileNameParams): string =>
  `recetas-hospitalizados-${startIso}-a-${endIso}.pdf`;

const formatIsoDayForDisplay = (isoDay: string): string => {
  const [year, month, day] = isoDay.split('-');
  if (!year || !month || !day) return isoDay;
  return `${day}-${month}-${year}`;
};

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hour}:${minute}`;
};

const describeRecord = (record: PrescriptionRecord): string => {
  const assignmentScope = resolvePrescriptionAssignmentScope(record);
  if (assignmentScope === 'hospitalized_stock') {
    return PRESCRIPTION_ASSIGNMENT_SCOPE_LABELS.hospitalized_stock;
  }
  if (assignmentScope === 'unassigned') {
    return PRESCRIPTION_ASSIGNMENT_SCOPE_LABELS.unassigned;
  }
  return [record.bedId, record.patientName, record.patientRut].filter(Boolean).join(' · ');
};

const normalizeOptions = (
  options?: Partial<PrescriptionMonthlyPdfOptions>
): PrescriptionMonthlyPdfOptions => ({
  prescriptionsPerPage:
    options?.prescriptionsPerPage ?? DEFAULT_PRESCRIPTION_MONTHLY_PDF_OPTIONS.prescriptionsPerPage,
  colorMode: options?.colorMode ?? DEFAULT_PRESCRIPTION_MONTHLY_PDF_OPTIONS.colorMode,
  imageQuality: options?.imageQuality ?? DEFAULT_PRESCRIPTION_MONTHLY_PDF_OPTIONS.imageQuality,
});

const resolveImageStoragePath = (record: PrescriptionRecord): string => record.image.storagePath;

const buildOptimizedPrescriptionImageUrl = (
  downloadUrl: string,
  imageQuality: PrescriptionMonthlyPdfImageQuality
): string => {
  const preset = PRESCRIPTION_PDF_IMAGE_QUALITY_PRESETS[imageQuality];
  if (!preset) return downloadUrl;

  const params = new URLSearchParams({
    url: downloadUrl,
    w: String(preset.width),
    q: String(preset.quality),
  });
  return `/.netlify/functions/prescription-image-proxy?${params.toString()}`;
};

const resolvePrintableImageAsset = async (
  downloadUrl: string,
  imageQuality: PrescriptionMonthlyPdfImageQuality
): Promise<PrintablePrescriptionImageAsset> => {
  const preset = PRESCRIPTION_PDF_IMAGE_QUALITY_PRESETS[imageQuality];
  if (!preset) {
    return { optimizationFallback: false, url: downloadUrl };
  }

  try {
    const proxyResponse = await fetch(
      buildOptimizedPrescriptionImageUrl(downloadUrl, imageQuality)
    );
    if (!proxyResponse.ok) {
      return { optimizationFallback: true, url: downloadUrl };
    }

    const blob = await proxyResponse.blob();
    const objectUrl = URL.createObjectURL(blob);
    return {
      optimizationFallback:
        proxyResponse.headers.get('X-Prescription-Image-Optimization') === 'fallback',
      revoke: () => URL.revokeObjectURL(objectUrl),
      url: objectUrl,
    };
  } catch {
    return { optimizationFallback: true, url: downloadUrl };
  }
};

const chunkRecords = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const waitForImage = (image: HTMLImageElement): Promise<void> => {
  if (image.complete) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const timeout = window.setTimeout(resolve, IMAGE_LOAD_TIMEOUT_MS);
    const finish = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', finish, { once: true });
  });
};

const createPrintStyle = (): HTMLStyleElement => {
  const style = document.createElement('style');
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    @media print {
      body > :not(#${PRINT_ROOT_ID}) { display: none !important; }
      #${PRINT_ROOT_ID} {
        position: static !important;
        left: auto !important;
        top: auto !important;
        width: auto !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }
    }
    @page { size: A4; margin: 10mm; }
    #${PRINT_ROOT_ID} {
      position: fixed;
      left: -10000px;
      top: 0;
      width: 210mm;
      opacity: 0;
      pointer-events: none;
      background: white;
      color: #0f172a;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .prescription-monthly-page {
      break-after: page;
      page-break-after: always;
      height: 276mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: hidden;
    }
    .prescription-monthly-page:last-child {
      break-after: auto;
      page-break-after: auto;
    }
    .prescription-monthly-header {
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 8px;
    }
    .prescription-monthly-title {
      font-size: 16px;
      font-weight: 800;
      margin: 0 0 4px;
    }
    .prescription-monthly-meta {
      color: #475569;
      font-size: 11px;
      margin: 0;
    }
    .prescription-monthly-grid {
      flex: 1;
      display: grid;
      gap: 10px;
      min-height: 0;
    }
    #${PRINT_ROOT_ID}[data-prescriptions-per-page="1"] .prescription-monthly-grid {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr;
    }
    #${PRINT_ROOT_ID}[data-prescriptions-per-page="2"] .prescription-monthly-grid {
      grid-template-columns: 1fr;
      grid-template-rows: repeat(2, minmax(0, 1fr));
    }
    #${PRINT_ROOT_ID}[data-prescriptions-per-page="4"] .prescription-monthly-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(2, minmax(0, 1fr));
    }
    #${PRINT_ROOT_ID}[data-prescriptions-per-page="6"] .prescription-monthly-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(3, minmax(0, 1fr));
    }
    .prescription-monthly-card {
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px;
      overflow: hidden;
    }
    .prescription-monthly-card-meta {
      color: #475569;
      font-size: 9px;
      line-height: 1.25;
      margin: 0;
    }
    .prescription-monthly-image-wrap {
      min-height: 0;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .prescription-monthly-image {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    #${PRINT_ROOT_ID}[data-color-mode="grayscale"] {
      filter: grayscale(1) contrast(1.12) !important;
      -webkit-filter: grayscale(1) contrast(1.12) !important;
    }
    #${PRINT_ROOT_ID}[data-color-mode="grayscale"] .prescription-monthly-image {
      filter: grayscale(1) contrast(1.12) !important;
      -webkit-filter: grayscale(1) contrast(1.12) !important;
    }
    #${PRINT_ROOT_ID}[data-image-quality="reduced"] .prescription-monthly-image {
      max-width: 92%;
      max-height: 92%;
    }
    #${PRINT_ROOT_ID}[data-image-quality="compact"] .prescription-monthly-image {
      max-width: 84%;
      max-height: 84%;
    }
  `;
  return style;
};

const createPrescriptionCard = (
  record: PrescriptionRecord,
  imageUrl: string,
  index: number
): HTMLElement => {
  const card = document.createElement('section');
  card.className = 'prescription-monthly-card';
  const type = document.createElement('p');
  type.className = 'prescription-monthly-card-meta';
  type.textContent = PRESCRIPTION_TYPE_LABELS[record.prescriptionType];

  const patient = document.createElement('p');
  patient.className = 'prescription-monthly-card-meta';
  patient.textContent = `${index + 1}. ${describeRecord(record) || 'Sin paciente asignado'} · ${formatDateTime(record.createdAt)}`;

  const imageWrap = document.createElement('div');
  imageWrap.className = 'prescription-monthly-image-wrap';

  const image = document.createElement('img');
  image.className = 'prescription-monthly-image';
  image.src = imageUrl;
  image.alt = `Receta ${index + 1}`;
  image.loading = 'eager';

  card.append(type, patient, imageWrap);
  imageWrap.append(image);
  return card;
};

const createPrescriptionPage = (
  records: PrescriptionRecord[],
  imageUrls: string[],
  pageIndex: number,
  pageCount: number,
  pageStartIndex: number,
  scope: MonthlyPrescriptionPdfScope
): HTMLElement => {
  const page = document.createElement('article');
  page.className = 'prescription-monthly-page';

  const header = document.createElement('header');
  header.className = 'prescription-monthly-header';

  const title = document.createElement('h1');
  title.className = 'prescription-monthly-title';
  title.textContent = 'Recetas Hospitalizados';

  const range = document.createElement('p');
  range.className = 'prescription-monthly-meta';
  range.textContent = `${formatIsoDayForDisplay(scope.startIso)} a ${formatIsoDayForDisplay(scope.endIso)} · página ${pageIndex + 1} de ${pageCount}`;

  const grid = document.createElement('div');
  grid.className = 'prescription-monthly-grid';
  records.forEach((record, index) => {
    grid.append(createPrescriptionCard(record, imageUrls[index] ?? '', pageStartIndex + index));
  });

  header.append(title, range);
  page.append(header, grid);
  return page;
};

export const exportMonthlyPrescriptionsPdf = async ({
  records,
  selectedDateIso,
  options,
}: ExportMonthlyPrescriptionsPdfParams): Promise<ExportMonthlyPrescriptionsPdfResult> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('La generación de PDF mensual requiere un navegador.');
  }

  const scope = collectMonthlyPrescriptionExport(records, selectedDateIso);
  if (scope.records.length === 0) {
    throw new Error('No hay recetas registradas para el mes seleccionado.');
  }

  document.getElementById(PRINT_ROOT_ID)?.remove();
  document.getElementById(PRINT_STYLE_ID)?.remove();

  const root = document.createElement('section');
  root.id = PRINT_ROOT_ID;
  const resolvedOptions = normalizeOptions(options);
  root.dataset.prescriptionsPerPage = String(resolvedOptions.prescriptionsPerPage);
  root.dataset.colorMode = resolvedOptions.colorMode;
  root.dataset.imageQuality = resolvedOptions.imageQuality;
  const style = createPrintStyle();
  const imageAssets = await Promise.all(
    scope.records.map(async record => {
      const downloadUrl = await resolvePrescriptionImageDownloadUrl(
        resolveImageStoragePath(record)
      );
      return resolvePrintableImageAsset(downloadUrl, resolvedOptions.imageQuality);
    })
  );
  const imageUrls = imageAssets.map(asset => asset.url);
  const optimizationFallbackCount = imageAssets.filter(asset => asset.optimizationFallback).length;

  const recordPages = chunkRecords(scope.records, resolvedOptions.prescriptionsPerPage);
  recordPages.forEach((pageRecords, pageIndex) => {
    const pageStartIndex = pageIndex * resolvedOptions.prescriptionsPerPage;
    root.append(
      createPrescriptionPage(
        pageRecords,
        imageUrls.slice(pageStartIndex, pageStartIndex + pageRecords.length),
        pageIndex,
        recordPages.length,
        pageStartIndex,
        scope
      )
    );
  });

  const fileName = buildMonthlyPrescriptionPdfFileName(scope);
  const originalTitle = document.title;
  document.title = fileName;
  document.head.append(style);
  document.body.append(root);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    root.remove();
    style.remove();
    imageAssets.forEach(asset => asset.revoke?.());
    document.title = originalTitle;
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup, { once: true });
  window.setTimeout(cleanup, PRINT_CLEANUP_TIMEOUT_MS);
  await Promise.allSettled(Array.from(root.querySelectorAll('img')).map(waitForImage));
  window.setTimeout(() => {
    window.print();
  }, PRINT_TRIGGER_DELAY_MS);

  return { exportedCount: scope.records.length, fileName, optimizationFallbackCount };
};
