export interface CensusWorkbookSheetDescriptor {
  recordDate: string;
  sheetName: string;
  snapshotLabel?: string;
  sortOrder?: number;
  recordLookupIndex?: number;
}

export interface CensusMasterWorkbookOptions {
  sheetDescriptors?: CensusWorkbookSheetDescriptor[];
}
