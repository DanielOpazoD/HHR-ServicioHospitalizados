/**
 * useExistingDaysQuery Hook
 * Replaces the legacy useExistingDays hook with TanStack Query.
 * Resolves race conditions when changing months and provides a centralized cache.
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/config/queryClient';
import { fetchExistingDaysInMonth } from '@/services/records/recordQueryService';
import {
  DAILY_RECORD_STORE_CHANGED_EVENT,
  type DailyRecordStoreChangedEventDetail,
  isDailyRecordStoreChangeRelevantToMonth,
} from '@/services/storage/indexeddb/indexedDbRecordEvents';

/**
 * Hook to calculate which days in the selected month have patient data.
 * @param selectedYear - The year selected in navigation
 * @param selectedMonth - The month selected in navigation (0-indexed)
 */
export const useExistingDaysQuery = (selectedYear: number, selectedMonth: number) => {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.existingDays.byMonth(selectedYear, selectedMonth);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleStoreChanged = (event: Event) => {
      const detail = (event as CustomEvent<DailyRecordStoreChangedEventDetail>).detail;
      if (!isDailyRecordStoreChangeRelevantToMonth(detail, selectedYear, selectedMonth + 1)) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey });
    };

    window.addEventListener(DAILY_RECORD_STORE_CHANGED_EVENT, handleStoreChanged);
    return () => window.removeEventListener(DAILY_RECORD_STORE_CHANGED_EVENT, handleStoreChanged);
  }, [queryClient, queryKey, selectedYear, selectedMonth]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      // selectedMonth is 0-indexed in JS (0=Jan), but our records use 1-indexed strings (01=Jan)
      return await fetchExistingDaysInMonth(selectedYear, selectedMonth + 1);
    },
    staleTime: 1000 * 60 * 5,
  });
};
