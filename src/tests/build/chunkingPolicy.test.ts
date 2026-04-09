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
