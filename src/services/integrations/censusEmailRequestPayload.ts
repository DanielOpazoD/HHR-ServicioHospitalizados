import type { CensusExportRecord } from '@/services/contracts/censusExportServiceContracts';
import type { CensusWorkbookSheetDescriptor } from '@/services/exporters/censusMasterWorkbook';
import {
  CensusEmailRequestPayloadSchema,
  type CensusEmailRequestPayload,
} from '@/contracts/serverless';

export interface CensusEmailRequestPayloadInput extends Omit<
  CensusEmailRequestPayload,
  'shareLink'
> {
  date: string;
  records: CensusExportRecord[];
  recipients: string[];
  nursesSignature?: string;
  body?: string;
  sheetDescriptors?: CensusWorkbookSheetDescriptor[];
}

export const buildCensusEmailRequestBody = (input: CensusEmailRequestPayloadInput): string =>
  JSON.stringify(
    CensusEmailRequestPayloadSchema.parse({
      date: input.date,
      records: input.records,
      recipients: input.recipients,
      nursesSignature: input.nursesSignature,
      body: input.body,
      sheetDescriptors: input.sheetDescriptors,
    })
  );
