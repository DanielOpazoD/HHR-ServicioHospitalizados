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

export const usePatientMovementAudit = () => {
  const hasLegacyDischargeLogger = 'logPatientDischarge' in auditServiceLegacy;
  const hasLegacyTransferLogger = 'logPatientTransfer' in auditServiceLegacy;

  let logPatientDischarge: (
    bedId: string,
    patientName: string,
    rut: string,
    status: string,
    recordDate: string
  ) => void = hasLegacyDischargeLogger
    ? (bedId: string, patientName: string, rut: string, status: string, recordDate: string) => {
        void auditServiceLegacy.logPatientDischarge?.(bedId, patientName, rut, status, recordDate);
      }
    : () => undefined;
  let logPatientTransfer: (
    bedId: string,
    patientName: string,
    rut: string,
    destination: string,
    recordDate: string
  ) => void = hasLegacyTransferLogger
    ? (
        bedId: string,
        patientName: string,
        rut: string,
        destination: string,
        recordDate: string
      ) => {
        void auditServiceLegacy.logPatientTransfer?.(
          bedId,
          patientName,
          rut,
          destination,
          recordDate
        );
      }
    : () => undefined;

  const logDischargeEntries = useCallback(
    (entries: DischargeAuditEntry[], recordDate: string) => {
      for (const entry of entries) {
        logPatientDischarge(entry.bedId, entry.patientName, entry.rut, entry.status, recordDate);
      }
    },
    [logPatientDischarge]
  );

  const logTransferEntry = useCallback(
    (entry: TransferAuditEntry, recordDate: string) => {
      logPatientTransfer(
        entry.bedId,
        entry.patientName,
        entry.rut,
        entry.receivingCenter,
        recordDate
      );
    },
    [logPatientTransfer]
  );

  return useMemo(
    () => ({
      logDischargeEntries,
      logTransferEntry,
    }),
    [logDischargeEntries, logTransferEntry]
  );
};
