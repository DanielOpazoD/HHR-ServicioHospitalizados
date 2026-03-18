import { useState, useCallback } from 'react';
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
} from '@/application/ports/dailyRecordPort';
import { defaultPatientMasterWritePort } from '@/application/ports/patientMasterPort';
import { defaultAuditPort } from '@/application/ports/auditPort';
import { logger } from '@/services/utils/loggerService';

export type { Conflict, AnalysisResult } from '@/application/patient-flow/patientAnalysisUseCase';

const patientAnalysisLogger = logger.child('usePatientAnalysis');

const resolveOutcomeErrorMessage = (
  outcome: {
    userSafeMessage?: string;
    issues: Array<{ userSafeMessage?: string; message?: string }>;
  },
  fallbackMessage: string
): string =>
  outcome.userSafeMessage ||
  outcome.issues[0]?.userSafeMessage ||
  outcome.issues[0]?.message ||
  fallbackMessage;

export const usePatientAnalysis = () => {
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
          dailyRecordRepository: {
            getAvailableDates: defaultDailyRecordReadPort.getAvailableDates,
            getForDate: defaultDailyRecordReadPort.getForDate,
            updatePartial: defaultDailyRecordWritePort.updatePartial,
          },
          auditPort: defaultAuditPort,
          currentUserEmail: getCurrentUserEmail(),
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
    [analysis]
  );

  const runAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysis(null);
    setMigrationResult(null);

    try {
      const outcome = await executeAnalyzePatients({
        dailyRecordRepository: {
          getAvailableDates: defaultDailyRecordReadPort.getAvailableDates,
          getForDate: defaultDailyRecordReadPort.getForDate,
          updatePartial: defaultDailyRecordWritePort.updatePartial,
        },
      });
      if (outcome.status === 'failed') {
        patientAnalysisLogger.error(
          'Analysis failed',
          new Error(resolveOutcomeErrorMessage(outcome, 'Analysis failed'))
        );
      }
      setAnalysis(outcome.data);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const runMigration = useCallback(async () => {
    if (!analysis || analysis.validPatients.length === 0) return;

    setIsMigrating(true);
    try {
      const outcome = await executeMigratePatients({
        analysis,
        patientMasterRepository: defaultPatientMasterWritePort,
      });
      if (outcome.status === 'failed') {
        patientAnalysisLogger.error(
          'Migration failed',
          new Error(resolveOutcomeErrorMessage(outcome, 'Migration failed'))
        );
      }
      if (outcome.data) {
        setMigrationResult(outcome.data);
      }
    } finally {
      setIsMigrating(false);
    }
  }, [analysis]);

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
