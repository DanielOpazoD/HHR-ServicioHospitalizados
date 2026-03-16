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
});
