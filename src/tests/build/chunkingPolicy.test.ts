import { describe, expect, it } from 'vitest';
import { chunkForModule } from '../../../scripts/config/chunkingPolicy';

describe('chunkingPolicy', () => {
  it('keeps shared census storage modules inside feature-backup-storage', () => {
    expect(chunkForModule('/repo/src/application/backup-export/sharedCensusFilesUseCases.ts')).toBe(
      'feature-backup-storage'
    );

    expect(chunkForModule('/repo/src/services/backup/censusStorageService.ts')).toBe(
      'feature-backup-storage'
    );
  });

  it('does not recreate the removed shared-census-storage chunk', () => {
    const assignedChunks = [
      chunkForModule('/repo/src/application/backup-export/sharedCensusFilesUseCases.ts'),
      chunkForModule('/repo/src/services/backup/censusStorageService.ts'),
      chunkForModule('/repo/src/services/backup/baseStorageService.ts'),
    ];

    expect(assignedChunks).not.toContain('feature-shared-census-storage');
  });

  it('still preserves focused feature chunks for census runtime and patient row', () => {
    expect(chunkForModule('/repo/src/features/census/components/patient-row/PatientRow.tsx')).toBe(
      'feature-census-patient-row'
    );

    expect(
      chunkForModule('/repo/src/features/census/controllers/patientMovementController.ts')
    ).toBe('feature-census-runtime');
  });

  it('keeps clinical documents and transfers isolated in their own feature chunks', () => {
    expect(
      chunkForModule('/repo/src/features/clinical-documents/components/ClinicalDocumentsModal.tsx')
    ).toBe('feature-clinical-documents');

    expect(
      chunkForModule('/repo/src/features/transfers/components/components/TransferStatusBadge.tsx')
    ).toBe('feature-transfers');
  });

  it('splits heavyweight vendor capabilities by runtime concern', () => {
    expect(chunkForModule('/repo/node_modules/firebase/firestore/dist/index.mjs')).toBe(
      'vendor-firebase-core'
    );
    expect(chunkForModule('/repo/node_modules/firebase/storage/dist/index.mjs')).toBe(
      'vendor-firebase-aux'
    );
    expect(chunkForModule('/repo/node_modules/three/build/three.module.js')).toBe(
      'vendor-three-core'
    );
    expect(chunkForModule('/repo/node_modules/jspdf/dist/jspdf.es.min.js')).toBe('vendor-pdf');
  });
});
