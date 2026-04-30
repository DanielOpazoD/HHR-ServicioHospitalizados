import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { chunkForModule } from '../../../scripts/config/chunkingPolicy';

const readSource = (relativePath: string): string =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const collectProductionSourceFiles = (directory: string): string[] => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap(entry => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'tests') {
        return [];
      }
      return collectProductionSourceFiles(absolutePath);
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) {
      return [];
    }
    return [absolutePath];
  });
};

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
  });

  it('never assigns app-level source modules to manual chunks', () => {
    // App source must NOT be forced into named chunks — this caused circular
    // vendor↔feature dependencies that crashed production (createContext undefined).
    const appPaths = [
      '/repo/src/features/census/context/censusActionContexts.ts',
      '/repo/src/features/census/components/patient-row/PatientRow.tsx',
      '/repo/src/features/census/controllers/patientMovementController.ts',
      '/repo/src/features/clinical-documents/components/ClinicalDocumentsModal.tsx',
      '/repo/src/application/backup-export/backupExportService.ts',
      '/repo/src/services/backup/censusStorageService.ts',
    ];
    for (const p of appPaths) {
      expect(chunkForModule(p), `${p} should NOT be manually chunked`).toBeUndefined();
    }
  });

  it('allows a targeted manual chunk for the authenticated app shell tree', () => {
    expect(chunkForModule('/repo/src/app-shell/runtime/AuthenticatedAppShell.tsx')).toBe(
      'app-authenticated-shell'
    );
    expect(chunkForModule('/repo/src/app-shell/runtime/useAuthenticatedAppRuntime.ts')).toBe(
      'app-authenticated-shell'
    );
    expect(chunkForModule('/repo/src/components/layout/app-content/useAppContentRuntime.ts')).toBe(
      'app-authenticated-shell'
    );
  });

  it('keeps authenticated shell runtime off the hooks barrel to avoid pulling feature hooks into startup', () => {
    const guardedFiles = [
      'src/app-shell/runtime/useAuthenticatedAppRuntime.ts',
      'src/app-shell/bootstrap/useAppBootstrapState.ts',
    ];

    for (const file of guardedFiles) {
      expect(readSource(file), file).not.toMatch(/from ['"]@\/hooks['"]/);
    }
  });

  it('keeps backup export use cases out of the initial authenticated shell import graph', () => {
    const guardedFiles = ['src/hooks/useExportManager.ts', 'src/hooks/useBackupArchiveStatus.ts'];

    for (const file of guardedFiles) {
      expect(readSource(file), file).not.toMatch(
        /import\s+(?:\{[\s\S]*?\}|\*\s+as\s+\w+|\w+)\s+from ['"]@\/application\/backup-export\/backupExport(?:UseCases|ArchiveUseCases|StorageUseCases)['"]/
      );
    }
  });

  it('keeps production source off the backup export barrel', () => {
    const sourceFiles = collectProductionSourceFiles(path.resolve(process.cwd(), 'src'));
    const offenders = sourceFiles
      .filter(
        file =>
          file !==
          path.resolve(process.cwd(), 'src/application/backup-export/backupExportUseCases.ts')
      )
      .filter(file =>
        readSource(path.relative(process.cwd(), file)).includes(
          '@/application/backup-export/backupExportUseCases'
        )
      )
      .map(file => path.relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });

  it('keeps audit write/fetch use cases out of the authenticated shell startup path', () => {
    const useAuditSource = readSource('src/hooks/useAudit.ts');

    expect(useAuditSource).not.toMatch(
      /import\s+\{[\s\S]*execute(?:WriteAuditEvent|FetchAuditLogs)[\s\S]*\}\s+from ['"]@\/application\/audit\//
    );
  });

  it('keeps census runtime hooks off legacy audit services during startup', () => {
    const guardedFiles = ['src/hooks/useBedAudit.ts', 'src/hooks/usePatientMovementAudit.ts'];

    for (const file of guardedFiles) {
      expect(readSource(file), file).not.toMatch(
        /from ['"]@\/services\/admin\/audit(?:Service|DomainLoggers)['"]/
      );
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
