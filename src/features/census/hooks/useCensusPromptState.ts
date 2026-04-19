import { useEffect, useRef, useState } from 'react';
import {
  executeLoadCensusPromptDataController,
  INITIAL_CENSUS_PROMPT_STATE,
  type CensusPromptState,
} from '@/features/census/controllers/censusLogicController';
import { defaultDailyRecordReadPort } from '@/application/ports/dailyRecordPort';
import { DAILY_RECORD_STORE_CHANGED_EVENT } from '@/services/storage/indexeddb/indexedDbRecordEvents';

export const useCensusPromptState = (currentDateString: string): CensusPromptState => {
  const [promptState, setPromptState] = useState(INITIAL_CENSUS_PROMPT_STATE);
  const [reloadVersion, setReloadVersion] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleStoreChanged = () => {
      setReloadVersion(currentVersion => currentVersion + 1);
    };

    window.addEventListener(DAILY_RECORD_STORE_CHANGED_EVENT, handleStoreChanged);
    return () => window.removeEventListener(DAILY_RECORD_STORE_CHANGED_EVENT, handleStoreChanged);
  }, []);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let isDisposed = false;

    void (async () => {
      const nextPromptState = await executeLoadCensusPromptDataController({
        currentDateString,
        getPreviousDay: defaultDailyRecordReadPort.getPreviousDay,
        getAvailableDates: defaultDailyRecordReadPort.getAvailableDates,
      });

      if (isDisposed || requestId !== requestIdRef.current) {
        return;
      }

      setPromptState(nextPromptState);
    })();

    return () => {
      isDisposed = true;
    };
  }, [currentDateString, reloadVersion]);

  return promptState;
};
