import { useCallback, useMemo, useState } from 'react';
import { getCurrentUserEmail } from '@/services/admin/utils/auditUtils';
import {
  executeAnalyzePatients,
  executeMigratePatients,
  executeResolvePatientConflict,
  type AnalysisResult,
} from '@/application/patient-flow/patientAnalysisUseCase';
import {
  defaultDailyRecordReadPort,
  defaultDailyRecordWritePort,
  type DailyRecordReadPort,
  type DailyRecordWritePort,
} from '@/application/ports/dailyRecordPort';
import {
  defaultPatientMasterWritePort,
  type PatientMasterWritePort,
} from '@/application/ports/patientMasterPort';
import { defaultAuditPort, type AuditPort } from '@/application/ports/auditPort';
import { resolveApplicationOutcomeMessage } from '@/application/shared/applicationOutcomeMessage';
import { patientAnalysisLogger } from '@/hooks/hookLoggers';

export type { Conflict, AnalysisResult } from '@/application/patient-flow/patientAnalysisUseCase';

type PatientAnalysisDailyRecordPort = Pick<
  DailyRecordReadPort & DailyRecordWritePort,
  'getAvailableDates' | 'getForDate' | 'updatePartial'
>;

export interface PatientAnalysisDependencies {
  dailyRecordRepository: PatientAnalysisDailyRecordPort;
  patientMasterRepository: PatientMasterWritePort;
  auditPort: Pick<AuditPort, 'writeEvent'>;
  getCurrentUserEmail: () => string;
}

const defaultPatientAnalysisDependencies: PatientAnalysisDependencies = {
  dailyRecordRepository: {
    getAvailableDates: defaultDailyRecordReadPort.getAvailableDates,
    getForDate: defaultDailyRecordReadPort.getForDate,
    updatePartial: defaultDailyRecordWritePort.updatePartial,
  },
  patientMasterRepository: defaultPatientMasterWritePort,
  auditPort: defaultAuditPort,
  getCurrentUserEmail,
};

const resolvePatientAnalysisDependencies = (
  dependencies?: Partial<PatientAnalysisDependencies>
): PatientAnalysisDependencies => ({
  dailyRecordRepository:
    dependencies?.dailyRecordRepository || defaultPatientAnalysisDependencies.dailyRecordRepository,
  patientMasterRepository:
    dependencies?.patientMasterRepository ||
    defaultPatientAnalysisDependencies.patientMasterRepository,
  auditPort: dependencies?.auditPort || defaultPatientAnalysisDependencies.auditPort,
  getCurrentUserEmail:
    dependencies?.getCurrentUserEmail || defaultPatientAnalysisDependencies.getCurrentUserEmail,
});

export const usePatientAnalysis = (dependencies?: Partial<PatientAnalysisDependencies>) => {
  const resolvedDependencies = useMemo(
    () => resolvePatientAnalysisDependencies(dependencies),
    [dependencies]
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isHarmonizing, setIsHarmonizing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [migrationResult, setMigrationResult] = useState<{
    successes: number;
    errors: number;
  } | null>(null);

  const resolveConflict = useCallback(
    async (rut: string, correctName: string, harmonizeHistory: boolean = false) => {
      if (harmonizeHistory) {
        setIsHarmonizing(true);
      }

      try {
        const outcome = await executeResolvePatientConflict({
          analysis,
          rut,
          correctName,
          harmonizeHistory,
          dailyRecordRepository: resolvedDependencies.dailyRecordRepository,
          auditPort: resolvedDependencies.auditPort,
          currentUserEmail: resolvedDependencies.getCurrentUserEmail(),
        });

        if (outcome.data) {
          setAnalysis(outcome.data);
        }
      } catch (error) {
        patientAnalysisLogger.error('Harmonization failed', error);
      } finally {
        if (harmonizeHistory) {
          setIsHarmonizing(false);
        }
      }
    },
    [analysis, resolvedDependencies]
  );

  const runAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysis(null);
    setMigrationResult(null);

    try {
      const outcome = await executeAnalyzePatients({
        dailyRecordRepository: resolvedDependencies.dailyRecordRepository,
      });
      if (outcome.status === 'failed') {
        patientAnalysisLogger.error(
          'Analysis failed',
          new Error(resolveApplicationOutcomeMessage(outcome, 'Analysis failed'))
        );
      }
      setAnalysis(outcome.data);
    } finally {
      setIsAnalyzing(false);
    }
  }, [resolvedDependencies]);

  const runMigration = useCallback(async () => {
    if (!analysis || analysis.validPatients.length === 0) return;

    setIsMigrating(true);
    try {
      const outcome = await executeMigratePatients({
        analysis,
        patientMasterRepository: resolvedDependencies.patientMasterRepository,
      });
      if (outcome.status === 'failed') {
        patientAnalysisLogger.error(
          'Migration failed',
          new Error(resolveApplicationOutcomeMessage(outcome, 'Migration failed'))
        );
      }
      if (outcome.data) {
        setMigrationResult(outcome.data);
      }
    } finally {
      setIsMigrating(false);
    }
  }, [analysis, resolvedDependencies]);

  return {
    isAnalyzing,
    isMigrating,
    isHarmonizing,
    analysis,
    migrationResult,
    runAnalysis,
    runMigration,
    resolveConflict,
  };
};
