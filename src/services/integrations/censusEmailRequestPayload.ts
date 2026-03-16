import { DailyRecord } from '@/types/domain/dailyRecord';
import type { CensusWorkbookSheetDescriptor } from '@/services/exporters/censusMasterWorkbook';

export interface CensusEmailRequestPayloadInput {
  date: string;
  records: DailyRecord[];
  recipients: string[];
  nursesSignature?: string;
  body?: string;
  shareLink?: string;
  sheetDescriptors?: CensusWorkbookSheetDescriptor[];
}

export const buildCensusEmailRequestBody = (input: CensusEmailRequestPayloadInput): string =>
  JSON.stringify({
    date: input.date,
    records: input.records,
    recipients: input.recipients,
    nursesSignature: input.nursesSignature,
    body: input.body,
    shareLink: input.shareLink,
    sheetDescriptors: input.sheetDescriptors,
  });
