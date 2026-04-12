import { useCallback, useMemo } from 'react';
import * as auditServiceLegacy from '@/services/admin/auditService';

interface DischargeAuditEntry {
  bedId: string;
  patientName: string;
  rut: string;
  status: 'Vivo' | 'Fallecido';
}

interface TransferAuditEntry {
  bedId: string;
  patientName: string;
  rut: string;
  receivingCenter: string;
}

const logLegacyMovementEntries = <T>(entries: readonly T[], logEntry: (entry: T) => void) => {
  for (const entry of entries) {
    logEntry(entry);
  }
};

export const usePatientMovementAudit = () => {
  const logDischargeEntries = useCallback((entries: DischargeAuditEntry[], recordDate: string) => {
    logLegacyMovementEntries(entries, entry => {
      void auditServiceLegacy.logPatientDischarge?.(
        entry.bedId,
        entry.patientName,
        entry.rut,
        entry.status,
        recordDate
      );
    });
  }, []);

  const logTransferEntry = useCallback((entry: TransferAuditEntry, recordDate: string) => {
    void auditServiceLegacy.logPatientTransfer?.(
      entry.bedId,
      entry.patientName,
      entry.rut,
      entry.receivingCenter,
      recordDate
    );
  }, []);

  return useMemo(
    () => ({
      logDischargeEntries,
      logTransferEntry,
    }),
    [logDischargeEntries, logTransferEntry]
  );
};
