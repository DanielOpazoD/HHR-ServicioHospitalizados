import { useMemo, useState } from 'react';
import { useDailyRecordData } from '@/context/DailyRecordContext';
import { getHospitalConfigById } from '@/constants/hospitalConfigs';
import { useTransferManagement } from '@/hooks/useTransferManagement';
import { useTransferViewStates } from '@/hooks/useTransferViewStates';
import {
  buildTransferManagementPeriodModel,
  TRANSFER_MONTH_LABELS,
} from '../components/controllers/transferManagementViewController';

export const useTransferManagementViewRuntime = () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [showFinalizedTransfers, setShowFinalizedTransfers] = useState(false);

  const transferManagement = useTransferManagement();
  const { record } = useDailyRecordData();
  const viewStates = useTransferViewStates(
    record,
    transferManagement.updateTransfer,
    transferManagement.createTransfer,
    transferManagement.advanceStatus,
    transferManagement.markAsTransferred,
    transferManagement.cancelTransfer
  );

  const periodModel = useMemo(
    () =>
      buildTransferManagementPeriodModel({
        transfers: transferManagement.transfers,
        selectedYear,
        selectedMonth,
        currentYear,
      }),
    [currentYear, selectedMonth, selectedYear, transferManagement.transfers]
  );

  const selectedHospital = useMemo(
    () => getHospitalConfigById(viewStates.selectedHospitalId),
    [viewStates.selectedHospitalId]
  );

  return {
    currentYear,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    showFinalizedTransfers,
    setShowFinalizedTransfers,
    monthLabels: TRANSFER_MONTH_LABELS,
    transferManagement,
    viewStates,
    periodModel,
    selectedHospital,
  };
};
