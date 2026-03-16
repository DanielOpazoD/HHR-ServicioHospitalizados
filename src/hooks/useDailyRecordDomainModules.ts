import type { DailyRecord, DailyRecordPatch } from '@/types/domain/dailyRecord';
import { useBedManagement } from '@/hooks/useBedManagement';
import { usePatientDischarges } from '@/hooks/usePatientDischarges';
import { usePatientTransfers } from '@/hooks/usePatientTransfers';
import { useNurseManagement, useTensManagement } from '@/hooks/useNurseManagement';
import { useCMA } from '@/hooks/useCMA';
import { useHandoffManagement } from '@/hooks/useHandoffManagement';
import { useInventory } from '@/hooks/useInventory';
import { useStabilityRules } from '@/hooks/useStabilityRules';
import { useValidation } from '@/hooks/useValidation';

export const useDailyRecordDomainModules = (
  record: DailyRecord | null,
  saveAndUpdate: (updatedRecord: DailyRecord) => Promise<void>,
  patchRecord: (partial: DailyRecordPatch) => Promise<void>
) => {
  const inventory = useInventory(record);
  const stabilityRules = useStabilityRules(record);
  const validation = useValidation();
  const bedManagement = useBedManagement(record, saveAndUpdate, patchRecord);
  const dischargeManagement = usePatientDischarges(record, saveAndUpdate);
  const transferManagement = usePatientTransfers(record, saveAndUpdate);
  const nurseManagement = useNurseManagement(record, patchRecord);
  const tensManagement = useTensManagement(record, patchRecord);
  const cmaManagement = useCMA(record, saveAndUpdate);
  const handoffManagement = useHandoffManagement(record, saveAndUpdate, patchRecord);

  return {
    inventory,
    stabilityRules,
    validation,
    bedManagement,
    dischargeManagement,
    transferManagement,
    nurseManagement,
    tensManagement,
    cmaManagement,
    handoffManagement,
  };
};
