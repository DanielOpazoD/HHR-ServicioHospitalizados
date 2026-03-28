import type { DailyRecordBedsState, DailyRecordDateRef } from '@/types/domain/dailyRecordSlices';

export type FhirRecord = DailyRecordBedsState & DailyRecordDateRef;
