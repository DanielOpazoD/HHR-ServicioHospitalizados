import { describe, expect, it } from 'vitest';
import { chunkForModule } from '../../../scripts/config/chunkingPolicy';

describe('chunkingPolicy', () => {
  it('does not force manual chunks for application source modules', () => {
    expect(chunkForModule('/repo/src/services/backup/censusStorageService.ts')).toBeUndefined();
    expect(
      chunkForModule('/repo/src/features/census/components/patient-row/PatientRow.tsx')
    ).toBeUndefined();
    expect(
      chunkForModule('/repo/src/features/census/controllers/patientMovementController.ts')
    ).toBeUndefined();
    expect(
      chunkForModule('/repo/src/features/clinical-documents/components/ClinicalDocumentsModal.tsx')
    ).toBeUndefined();
    expect(
      chunkForModule('/repo/src/features/transfers/components/components/TransferStatusBadge.tsx')
    ).toBeUndefined();
  });

  it('never assigns app-level source modules to manual chunks', () => {
    // App source must NOT be forced into named chunks — this caused circular
    // vendor↔feature dependencies that crashed production (createContext undefined).
    const appPaths = [
      '/repo/src/features/census/context/censusActionContexts.ts',
      '/repo/src/features/census/components/patient-row/PatientRow.tsx',
      '/repo/src/features/census/controllers/patientMovementController.ts',
      '/repo/src/features/clinical-documents/components/ClinicalDocumentsModal.tsx',
      '/repo/src/features/transfers/components/TransferStatusBadge.tsx',
      '/repo/src/application/backup-export/backupExportService.ts',
      '/repo/src/services/backup/censusStorageService.ts',
    ];
    for (const p of appPaths) {
      expect(chunkForModule(p), `${p} should NOT be manually chunked`).toBeUndefined();
    }
  });

  it('splits heavyweight vendor capabilities by runtime concern', () => {
    expect(chunkForModule('/repo/node_modules/firebase/auth/dist/index.esm.js')).toBe(
      'vendor-firebase-core'
    );
    expect(chunkForModule('/repo/node_modules/firebase/firestore/dist/index.mjs')).toBe(
      'vendor-firebase-firestore'
    );
    expect(chunkForModule('/repo/node_modules/firebase/storage/dist/index.mjs')).toBe(
      'vendor-firebase-aux'
    );
    expect(chunkForModule('/repo/node_modules/jspdf/dist/jspdf.es.min.js')).toBe('vendor-pdf-core');
  });

  it('isolates shared commonjs helpers from feature-labelled vendor chunks', () => {
    expect(chunkForModule('\u0000commonjsHelpers.js')).toBe('vendor-cjs-helpers');
    expect(chunkForModule('/repo/node_modules/.vite/deps/commonjsHelpers.js')).toBe(
      'vendor-cjs-helpers'
    );
  });
});
