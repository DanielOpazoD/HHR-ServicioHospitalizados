export const chunkForModule = (moduleId: string): string | undefined => {
  const normalizedId = moduleId.replace(/\\/g, '/');
  const inNodeModules = normalizedId.includes('/node_modules/');
  const has = (fragment: string): boolean => normalizedId.includes(fragment);

  if (!inNodeModules) {
    if (has('/src/features/census/components/patient-row/')) {
      return 'feature-census-patient-row';
    }

    if (
      has('/src/features/census/controllers/') ||
      has('/src/features/census/domain/movements/') ||
      has('/src/features/census/validation/')
    ) {
      return 'feature-census-runtime';
    }

    if (has('/src/features/clinical-documents/')) {
      return 'feature-clinical-documents';
    }

    if (has('/src/features/transfers/')) {
      return 'feature-transfers';
    }

    // Keep backup/storage together unless there is a clearly isolated runtime boundary.
    // A previous dedicated shared-census storage chunk created a production-only
    // initialization cycle with feature-backup-storage on Netlify.
    if (has('/src/application/backup-export/') || has('/src/services/backup/')) {
      return 'feature-backup-storage';
    }
  }

  if (inNodeModules) {
    if (
      has('/node_modules/react/') ||
      has('/node_modules/react-dom/') ||
      has('/node_modules/lucide-react/')
    ) {
      return 'vendor-react';
    }

    if (
      has('/node_modules/@tanstack/react-query/') ||
      has('/node_modules/@tanstack/query-core/') ||
      has('/node_modules/@tanstack/react-virtual/')
    ) {
      return 'vendor-tanstack';
    }

    if (has('/node_modules/dexie/')) {
      return 'vendor-localdb';
    }

    if (has('/node_modules/zod/')) {
      return 'vendor-zod';
    }

    if (has('/node_modules/firebase/') || has('/node_modules/@firebase/')) {
      if (
        has('/node_modules/firebase/storage') ||
        has('/node_modules/firebase/functions') ||
        has('/node_modules/@firebase/storage') ||
        has('/node_modules/@firebase/functions')
      ) {
        return 'vendor-firebase-aux';
      }
      return 'vendor-firebase-core';
    }

    if (has('/node_modules/html2canvas/')) {
      return 'vendor-canvas';
    }

    if (has('/node_modules/three/examples/')) {
      return 'vendor-three-stdlib';
    }
    if (has('/node_modules/three/')) {
      return 'vendor-three-core';
    }
    if (has('/node_modules/@react-three/')) {
      return 'vendor-three-react';
    }
    if (
      has('/node_modules/three-stdlib/') ||
      has('/node_modules/meshline/') ||
      has('/node_modules/troika-') ||
      has('/node_modules/camera-controls/')
    ) {
      return 'vendor-three-stdlib';
    }

    if (has('/node_modules/exceljs/lib/xlsx/')) {
      return 'vendor-excel-xlsx';
    }
    if (has('/node_modules/exceljs/lib/stream/')) {
      return 'vendor-excel-stream';
    }
    if (has('/node_modules/exceljs/lib/csv/')) {
      return 'vendor-excel-csv';
    }
    if (
      has('/node_modules/jszip/') ||
      has('/node_modules/pako/') ||
      has('/node_modules/crc32-stream/') ||
      has('/node_modules/compress-commons/')
    ) {
      return 'vendor-excel-zip';
    }
    if (
      has('/node_modules/readable-stream/') ||
      has('/node_modules/sax/') ||
      has('/node_modules/saxes/')
    ) {
      return 'vendor-excel-stream';
    }
    if (
      has('/node_modules/archiver/') ||
      has('/node_modules/fast-csv/') ||
      has('/node_modules/dayjs/')
    ) {
      return 'vendor-excel-xml';
    }
    if (has('/node_modules/exceljs/')) {
      return 'vendor-excel-core';
    }

    if (has('/node_modules/jspdf/') || has('/node_modules/jspdf-autotable/')) {
      return 'vendor-pdf';
    }
  }

  return undefined;
};
