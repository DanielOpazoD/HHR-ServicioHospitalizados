import { getPreviousDay } from '@/utils/clinicalDayUtils';
import type { DailyRecord } from '@/features/census/contracts/censusRecordContracts';

export interface CensusPromptState {
  previousRecordAvailable: boolean;
  previousRecordDate?: string;
  availableDates: string[];
}

export interface CensusPromptDataLoadDeps {
  currentDateString: string;
  getPreviousDay: (date: string) => Promise<DailyRecord | null>;
  getAvailableDates: () => Promise<string[]>;
}

export const INITIAL_CENSUS_PROMPT_STATE: CensusPromptState = {
  previousRecordAvailable: false,
  previousRecordDate: undefined,
  availableDates: [],
};

export const resolvePreviousDayState = (
  currentDateString: string,
  previousDay: DailyRecord | null,
  availableDates: string[] = []
): Pick<CensusPromptState, 'previousRecordAvailable' | 'previousRecordDate'> => ({
  previousRecordAvailable:
    previousDay?.date === getPreviousDay(currentDateString) ||
    availableDates.includes(getPreviousDay(currentDateString)),
  previousRecordDate:
    previousDay?.date === getPreviousDay(currentDateString) ||
    availableDates.includes(getPreviousDay(currentDateString))
      ? getPreviousDay(currentDateString)
      : undefined,
});

export const filterAvailableDates = (currentDateString: string, dates: string[]): string[] => {
  const uniqueDates = Array.from(new Set(dates));
  return uniqueDates.filter(date => date !== currentDateString);
};

export const executeLoadCensusPromptDataController = async ({
  currentDateString,
  getPreviousDay,
  getAvailableDates,
}: CensusPromptDataLoadDeps): Promise<CensusPromptState> => {
  const [previousDayResult, availableDatesResult] = await Promise.allSettled([
    getPreviousDay(currentDateString),
    getAvailableDates(),
  ]);

  const availableDates =
    availableDatesResult.status === 'fulfilled'
      ? filterAvailableDates(currentDateString, availableDatesResult.value)
      : [];

  return {
    ...resolvePreviousDayState(
      currentDateString,
      previousDayResult.status === 'fulfilled' ? previousDayResult.value : null,
      availableDates
    ),
    availableDates,
  };
};
