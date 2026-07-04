import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { chunkForModule } from '../../../scripts/config/chunkingPolicy';

const readSource = (relativePath: string): string =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const directAuditWriterImportPattern =
  /import\s+\{[\s\S]*executeWriteAuditEvent[\s\S]*\}\s+from ['"][^'"]*application\/audit\/writeAuditEventUseCase(?:\.ts)?['"]/;

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

  it('keeps non-critical global overlays outside the authenticated shell manual chunk', () => {
    expect(
      chunkForModule('/repo/src/components/layout/app-content/AppContentOverlays.tsx')
    ).toBeUndefined();
    expect(
      chunkForModule('/repo/src/components/layout/app-content/appContentOverlaysController.ts')
    ).toBeUndefined();
    expect(
      chunkForModule('/repo/src/components/layout/app-content/usePatientSearchShortcut.ts')
    ).toBeUndefined();
  });

  it('loads global overlays through a lazy boundary instead of the static shell graph', () => {
    const appContentSource = readSource('src/components/layout/AppContent.tsx');

    expect(appContentSource).not.toMatch(
      /import\s+\{\s*AppContentOverlays\s*\}\s+from ['"]@\/components\/layout\/app-content\/AppContentOverlays['"]/
    );
    expect(appContentSource).toContain(
      "import('@/components/layout/app-content/AppContentOverlays')"
    );
  });

  it('does not force domain providers into the authenticated shell budget', () => {
    expect(chunkForModule('/repo/src/context/ReminderCenterContext.tsx')).toBeUndefined();
  });

  it('keeps the reminder center provider out of the static authenticated shell import graph', () => {
    const appContentSource = readSource('src/components/layout/AppContent.tsx');
    const reminderProviderLoaderSource = readSource(
      'src/components/layout/app-content/reminderCenterProviderLoader.ts'
    );
    const reminderHookSource = readSource('src/hooks/useReminders.ts');
    const navbarSource = readSource('src/components/layout/Navbar.tsx');

    expect(appContentSource).not.toMatch(
      /import\s+\{[^}]*ReminderCenterProvider[^}]*\}\s+from ['"]@\/context\/ReminderCenterContext['"]/
    );
    expect(appContentSource).not.toContain("import('@/context/ReminderCenterContext')");
    expect(appContentSource).toContain(
      "from '@/components/layout/app-content/reminderCenterProviderLoader'"
    );
    expect(reminderProviderLoaderSource).toContain("import('@/context/ReminderCenterContext')");
    expect(reminderHookSource).not.toContain('@/context/ReminderCenterContext');
    expect(navbarSource).not.toMatch(
      /import\s+\{[^}]*ReminderBadge[^}]*\}\s+from ['"]@\/components\/reminders\/ReminderBadge['"]/
    );
    expect(navbarSource).toContain("import('@/components/reminders/ReminderBadge')");
  });

  it('keeps user avatar editing modal out of the static authenticated shell import graph', () => {
    const navbarSource = readSource('src/components/layout/Navbar.tsx');

    expect(navbarSource).not.toMatch(
      /import\s+\{[^}]*UserAvatarModal[^}]*\}\s+from ['"]\.\/UserAvatarModal['"]/
    );
    expect(navbarSource).toContain("import('./UserAvatarModal')");
  });

  it('keeps user avatar remote profile service out of the static authenticated shell import graph', () => {
    const userAvatarHookSource = readSource('src/hooks/useUserAvatarProfile.ts');

    expect(userAvatarHookSource).not.toMatch(
      /from ['"]@\/services\/user-profile\/userAvatarProfileService['"]/
    );
    expect(userAvatarHookSource).toContain("from '@/services/user-profile/userAvatarProfileCache'");
    expect(userAvatarHookSource).toContain(
      "import('@/services/user-profile/userAvatarProfileService')"
    );
  });

  it('keeps user avatar image processing helpers out of the static authenticated shell import graph', () => {
    const navbarSource = readSource('src/components/layout/Navbar.tsx');

    expect(navbarSource).not.toContain('@/components/layout/userAvatarImageController');
    expect(navbarSource).toContain('@/components/layout/userAvatarPresentationController');
  });

  it('keeps census email delivery use cases out of the static authenticated shell import graph', () => {
    const deliveryActionsSource = readSource('src/hooks/useCensusEmailDeliveryActions.ts');

    expect(deliveryActionsSource).not.toMatch(
      /from ['"]@\/application\/census-email\/sendCensusEmailUseCases['"]/
    );
    expect(deliveryActionsSource).toContain(
      "import('@/application/census-email/sendCensusEmailUseCases')"
    );
  });

  it('keeps secondary DateStrip action dropdowns out of the static authenticated shell import graph', () => {
    const dateStripSource = readSource('src/components/layout/DateStrip.tsx');

    expect(dateStripSource).not.toMatch(
      /from ['"]\.\/date-strip\/actions\/(?:SaveDropdown|HandoffSaveDropdown|EmailDropdown)['"]/
    );
    expect(dateStripSource).toContain("import('./date-strip/actions/SaveDropdown')");
    expect(dateStripSource).toContain("import('./date-strip/actions/HandoffSaveDropdown')");
    expect(dateStripSource).toContain("import('./date-strip/actions/EmailDropdown')");
  });

  it('keeps the census PDF quick action out of the static DateStrip shell import graph', () => {
    const dateStripSource = readSource('src/components/layout/DateStrip.tsx');

    expect(dateStripSource).not.toMatch(/from ['"]\.\/date-strip\/actions\/PdfButtons['"]/);
    expect(dateStripSource).toContain("import('./date-strip/actions/PdfButtons')");
  });

  it('keeps secondary DateStrip quick actions out of the static DateStrip shell import graph', () => {
    const dateStripSource = readSource('src/components/layout/DateStrip.tsx');

    expect(dateStripSource).not.toMatch(
      /from ['"]@\/components\/layout\/date-strip\/DateStripQuickActions['"]/
    );
    expect(dateStripSource).toContain(
      "import('@/components/layout/date-strip/DateStripQuickActions')"
    );
  });

  it('keeps the DateStrip bookmark toggle out of the static DateStrip shell import graph', () => {
    const dateStripSource = readSource('src/components/layout/DateStrip.tsx');

    expect(dateStripSource).not.toMatch(
      /from ['"]@\/components\/layout\/date-strip\/DateStripBookmarkToggle['"]/
    );
    expect(dateStripSource).toContain(
      "import('@/components/layout/date-strip/DateStripBookmarkToggle')"
    );
  });

  it('keeps DateStrip month and year navigators out of the static DateStrip shell import graph', () => {
    const dateStripSource = readSource('src/components/layout/DateStrip.tsx');

    expect(dateStripSource).not.toMatch(
      /from ['"]@\/components\/layout\/date-strip\/DateStrip(?:Month|Year)Navigator['"]/
    );
    expect(dateStripSource).toContain(
      "import('@/components/layout/date-strip/DateStripYearNavigator')"
    );
    expect(dateStripSource).toContain(
      "import('@/components/layout/date-strip/DateStripMonthNavigator')"
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

  it('keeps authenticated shell providers off the broad context barrel', () => {
    const guardedFiles = [
      'src/components/AppProviders.tsx',
      'src/app-shell/runtime/AuthenticatedAppShell.tsx',
      'src/app-shell/runtime/useAuthenticatedAppRuntime.ts',
    ];

    for (const file of guardedFiles) {
      expect(readSource(file), file).not.toMatch(/from ['"]@\/context['"]/);
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

  it('keeps backup export presentation helpers out of the initial authenticated shell import graph', () => {
    const exportManagerSource = readSource('src/hooks/useExportManager.ts');
    const archiveStatusSource = readSource('src/hooks/useBackupArchiveStatus.ts');
    const fileOperationsSource = readSource('src/hooks/useFileOperations.ts');

    expect(exportManagerSource).not.toMatch(
      /import\s+\{[\s\S]*(?:presentBackupExportOutcome|dispatchExportManagerNotice|buildBackupHandoffConfirmDescriptor)[\s\S]*\}\s+from ['"]@\/hooks\/controllers\//
    );
    expect(exportManagerSource).toContain(
      "import('@/hooks/controllers/backupExportOutcomeController')"
    );
    expect(exportManagerSource).toContain(
      "import('@/hooks/controllers/exportManagerNoticeController')"
    );
    expect(exportManagerSource).toContain(
      "import('@/hooks/controllers/exportManagerConfirmController')"
    );
    expect(archiveStatusSource).not.toContain('@/hooks/controllers/exportManagerController');
    expect(archiveStatusSource).toContain('@/hooks/controllers/backupArchiveStatusController');
    expect(archiveStatusSource).not.toMatch(
      /import\s+\{[\s\S]*presentBackupLookupOutcome[\s\S]*\}\s+from ['"]@\/hooks\/controllers\/backupStorageOutcomeController['"]/
    );
    expect(archiveStatusSource).toContain(
      "import('@/hooks/controllers/backupStorageOutcomeController')"
    );
    expect(fileOperationsSource).not.toMatch(
      /import\s+[\s\S]*\s+from ['"]@\/services\/exporters\/exportService['"]/
    );
    expect(fileOperationsSource).not.toMatch(
      /import\s+\{[\s\S]*executeImportJsonBackup[\s\S]*\}\s+from ['"]@\/application\/backup-export\/backupExportMaintenanceUseCases['"]/
    );
    expect(fileOperationsSource).not.toMatch(
      /import\s+\{[\s\S]*presentBackupExportOutcome[\s\S]*\}\s+from ['"]@\/hooks\/controllers\/backupExportOutcomeController['"]/
    );
    expect(fileOperationsSource).toContain("import('@/services/exporters/exportService')");
    expect(fileOperationsSource).toContain(
      "import('@/application/backup-export/backupExportMaintenanceUseCases')"
    );
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

  it('routes audit writer defaults through the lazy use-case loader instead of value-importing the use case', () => {
    const sourceFiles = collectProductionSourceFiles(path.resolve(process.cwd(), 'src'));
    const allowedFiles = new Set([
      path.resolve(process.cwd(), 'src/application/audit/writeAuditEventUseCase.ts'),
      path.resolve(process.cwd(), 'src/application/audit/writeAuditEventUseCaseLoader.ts'),
    ]);
    const offenders = sourceFiles
      .filter(file => !allowedFiles.has(file))
      .filter(file =>
        readSource(path.relative(process.cwd(), file)).match(directAuditWriterImportPattern)
      )
      .map(file => path.relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });

  it('detects direct audit writer imports even when they use a relative module path', () => {
    expect(
      "import { executeWriteAuditEvent } from '../../application/audit/writeAuditEventUseCase';"
    ).toMatch(directAuditWriterImportPattern);
  });

  it('keeps census runtime hooks off legacy audit services during startup', () => {
    const guardedFiles = ['src/hooks/useBedAudit.ts', 'src/hooks/usePatientMovementAudit.ts'];

    for (const file of guardedFiles) {
      expect(readSource(file), file).not.toMatch(
        /from ['"]@\/services\/admin\/audit(?:Service|DomainLoggers)['"]/
      );
    }
  });

  it('loads the initial census route from a dedicated view entrypoint instead of the modal-heavy public-components barrel', () => {
    const lazyViewsSource = readSource('src/views/LazyViews.ts');
    const censusPublicSource = readSource('src/features/census/public.ts');
    const censusViewBlock = lazyViewsSource.slice(
      lazyViewsSource.indexOf('export const CensusView'),
      lazyViewsSource.indexOf('export const CensusEmailConfigModal')
    );

    expect(lazyViewsSource).toContain('@/features/census/census-view');
    expect(censusViewBlock).not.toContain('@/features/census/public-components');
    expect(censusPublicSource).toContain("import('./census-view')");
    expect(censusPublicSource).not.toContain("import('./public-components')");
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
    expect(chunkForModule('/repo/node_modules/pdfjs-dist/legacy/build/pdf.mjs')).toBe(
      'vendor-pdfjs'
    );
    expect(chunkForModule('/repo/node_modules/heic2any/dist/heic2any.min.js')).toBe(
      'vendor-heic2any'
    );
  });

  it('keeps HEIC conversion behind its dedicated loader boundary', () => {
    const compressionServiceSource = readSource(
      'src/features/prescriptions/services/prescriptionImageCompressionService.ts'
    );
    const heicConverterSource = readSource(
      'src/features/prescriptions/services/prescriptionHighEfficiencyImageConverter.ts'
    );
    const heicLoaderSource = readSource(
      'src/features/prescriptions/services/prescriptionHeicConverterLoader.ts'
    );

    expect(compressionServiceSource).not.toContain("import('heic2any')");
    expect(compressionServiceSource).toContain(
      "from '@/features/prescriptions/services/prescriptionHighEfficiencyImageConverter'"
    );
    expect(heicConverterSource).not.toContain("import('heic2any')");
    expect(heicConverterSource).toContain(
      "from '@/features/prescriptions/services/prescriptionHeicConverterLoader'"
    );
    expect(heicLoaderSource).toContain("import('heic2any')");
  });

  it('keeps the node-only ExcelJS loader invisible to the browser bundler', () => {
    const browserLoaderSource = readSource('src/services/exporters/excelJsModuleLoader.ts');
    const nodeLoaderSource = readSource('src/services/exporters/excelJsModuleLoader.node.ts');
    const viteConfigSource = readSource('vite.config.ts');

    expect(browserLoaderSource).toContain('/vendor/exceljs.bare.min.js');
    expect(browserLoaderSource).not.toMatch(/await\s+import\(['"]exceljs['"]\)/);
    expect(browserLoaderSource).not.toContain('excelJsModuleLoader.node');
    expect(viteConfigSource).toContain('__ENABLE_NODE_EXCEL_LOADER__');
    expect(nodeLoaderSource).toContain('importExcelJsForNode');
  });

  it('keeps server-only Google APIs out of browser-facing source imports', () => {
    const sourceFiles = collectProductionSourceFiles(path.resolve(process.cwd(), 'src'));
    const allowedGoogleApisImporters = new Set([
      path.resolve(process.cwd(), 'src/services/email/gmailClient.ts'),
    ]);

    const offenders = sourceFiles
      .filter(file => !allowedGoogleApisImporters.has(file))
      .filter(file => {
        const source = readSource(path.relative(process.cwd(), file));
        return (
          /from ['"]googleapis['"]/.test(source) ||
          /import\(['"]googleapis['"]\)/.test(source) ||
          source.includes('@/services/email/gmailClient')
        );
      })
      .map(file => path.relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });

  it('isolates shared commonjs helpers from feature-labelled vendor chunks', () => {
    expect(chunkForModule('\u0000commonjsHelpers.js')).toBe('vendor-cjs-helpers');
    expect(chunkForModule('/repo/node_modules/.vite/deps/commonjsHelpers.js')).toBe(
      'vendor-cjs-helpers'
    );
  });
});
