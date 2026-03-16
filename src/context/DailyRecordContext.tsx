/**
 * DailyRecordContext
 *
 * Fragmented context system for optimal rendering of census data.
 *
 * 📘 GUÍA DE ESTILO: Para elegir el hook correcto y evitar problemas de performance,
 * consulta src/docs/HOOKS_STYLE_GUIDE.md
 */
import React, { createContext } from 'react';
import {
  DailyRecordContextType,
  DailyRecordDataContextType,
  SyncStatus,
  InventoryStats,
} from '@/hooks/useDailyRecordTypes';
import { PatientData } from '@/types/domain/patient';
import { DischargeData, TransferData, CMAData } from '@/types/domain/movements';
import { StabilityRules } from '@/hooks/useStabilityRules';
import { useDailyRecordFragmentedValues } from '@/context/useDailyRecordFragmentedValues';
import {
  DailyRecordActionsContext,
  useRequiredDailyRecordActionsContext,
} from './dailyRecordActionsContext';
import { useRequiredContextValue } from './contextHookSupport';

// 1. Specialized Contexts
const DailyRecordDataContext = createContext<DailyRecordDataContextType | undefined>(undefined);

// Fragmented Data Contexts
const DailyRecordBedsContext = createContext<Record<string, PatientData> | null | undefined>(
  undefined
);
const DailyRecordMovementsContext = createContext<
  | {
      discharges: DischargeData[];
      transfers: TransferData[];
      cma: CMAData[];
    }
  | null
  | undefined
>(undefined);
const DailyRecordSyncContext = createContext<
  | {
      syncStatus: SyncStatus;
      lastSyncTime: Date | null;
    }
  | undefined
>(undefined);
const DailyRecordStabilityContext = createContext<StabilityRules | null | undefined>(undefined);
const DailyRecordInventoryContext = createContext<InventoryStats | null | undefined>(undefined);
const DailyRecordStaffContext = createContext<
  | {
      nursesDayShift: string[];
      nursesNightShift: string[];
      tensDayShift: string[];
      tensNightShift: string[];
      activeExtraBeds: string[];
    }
  | null
  | undefined
>(undefined);
const DailyRecordOverridesContext = createContext<Record<string, string> | undefined>(undefined);

/**
 * Fragmented Provider
 * Wraps children in multiple specialized contexts to optimize re-renders.
 */
export const DailyRecordProvider: React.FC<{
  value: DailyRecordContextType;
  children: React.ReactNode;
}> = ({ value, children }) => {
  const {
    syncValue,
    bedsValue,
    movementsValue,
    stabilityValue,
    inventoryValue,
    staffValue,
    overridesValue,
    dataValue,
    actionsValue,
  } = useDailyRecordFragmentedValues(value);

  return (
    <DailyRecordActionsContext.Provider value={actionsValue}>
      <DailyRecordSyncContext.Provider value={syncValue}>
        <DailyRecordStabilityContext.Provider value={stabilityValue}>
          <DailyRecordInventoryContext.Provider value={inventoryValue}>
            <DailyRecordStaffContext.Provider value={staffValue}>
              <DailyRecordMovementsContext.Provider value={movementsValue}>
                <DailyRecordBedsContext.Provider value={bedsValue}>
                  <DailyRecordDataContext.Provider value={dataValue}>
                    <DailyRecordOverridesContext.Provider value={overridesValue}>
                      {children}
                    </DailyRecordOverridesContext.Provider>
                  </DailyRecordDataContext.Provider>
                </DailyRecordBedsContext.Provider>
              </DailyRecordMovementsContext.Provider>
            </DailyRecordStaffContext.Provider>
          </DailyRecordInventoryContext.Provider>
        </DailyRecordStabilityContext.Provider>
      </DailyRecordSyncContext.Provider>
    </DailyRecordActionsContext.Provider>
  );
};

// 2. Optimized Hooks

/**
 * Access only the full reactive data.
 * Re-renders when ANY part of the record or sync status changes.
 */
export const useDailyRecordData = () => {
  return useRequiredContextValue(DailyRecordDataContext, 'useDailyRecordData');
};

/**
 * Access only the beds data.
 * Re-renders only when record.beds changes.
 */
export const useDailyRecordBeds = () => {
  return useRequiredContextValue(DailyRecordBedsContext, 'useDailyRecordBeds');
};

/**
 * Access only movement data (discharges, transfers, cma).
 */
export const useDailyRecordMovements = () => {
  return useRequiredContextValue(DailyRecordMovementsContext, 'useDailyRecordMovements');
};

/**
 * Access only sync status.
 */
export const useDailyRecordSync = () => {
  return useRequiredContextValue(DailyRecordSyncContext, 'useDailyRecordSync');
};

/**
 * Access sync UI state (status badges, watchers, indicators).
 * Alias intentionally explicit for presentation-layer consumers.
 */
export const useDailyRecordStatus = () => {
  const { syncStatus, lastSyncTime } = useDailyRecordSync();
  return {
    syncStatus,
    lastSyncTime,
    isSaving: syncStatus === 'saving',
    hasError: syncStatus === 'error',
    isIdle: syncStatus === 'idle',
    isSaved: syncStatus === 'saved',
  };
};

/**
 * Access stability rules.
 */
export const useDailyRecordStability = () => {
  return useRequiredContextValue(DailyRecordStabilityContext, 'useDailyRecordStability');
};

/**
 * Access inventory stats.
 */
export const useDailyRecordInventory = () => {
  return useRequiredContextValue(DailyRecordInventoryContext, 'useDailyRecordInventory');
};

/**
 * Access staff data.
 */
export const useDailyRecordStaff = () => {
  return useRequiredContextValue(DailyRecordStaffContext, 'useDailyRecordStaff');
};

/**
 * Access bed type overrides.
 */
export const useDailyRecordOverrides = () => {
  return useRequiredContextValue(DailyRecordOverridesContext, 'useDailyRecordOverrides') || {};
};

/**
 * Access only stable actions.
 * Does NOT re-render when data changes. Use for buttons, forms, etc.
 */
export const useDailyRecordActions = () => {
  return useRequiredDailyRecordActionsContext('useDailyRecordActions');
};

/**
 * Legacy hook for compatibility.
 * Combines both (triggers re-renders on every data change).
 * @deprecated Prefer fragmented hooks: useDailyRecordData/useDailyRecordActions/useDailyRecordBeds...
 */
export const useDailyRecordContext = (): DailyRecordContextType => {
  const data = useDailyRecordData();
  const actions = useDailyRecordActions();
  return { ...data, ...actions };
};

// Hook for accessing specific bed data efficiently
export const usePatientData = (bedId: string) => {
  const beds = useDailyRecordBeds();
  return beds ? (beds as Record<string, PatientData>)[bedId] : undefined;
};

export {
  useDailyRecordBedActions,
  useDailyRecordCudyrActions,
  useDailyRecordDayActions,
  useDailyRecordHandoffActions,
  useDailyRecordMovementActions,
  useDailyRecordStaffActions,
} from '@/context/useDailyRecordScopedActions';
