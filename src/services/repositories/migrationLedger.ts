export interface SchemaEvolutionStep {
  fromVersion: number;
  toVersion: number;
  label: string;
  rationale: string;
}

export const DAILY_RECORD_SCHEMA_LEDGER: readonly SchemaEvolutionStep[] = [
  {
    fromVersion: 0,
    toVersion: 1,
    label: 'v0->v1',
    rationale: 'Promote legacy baseline records to the first governed runtime schema.',
  },
] as const;

export const getSchemaEvolutionLedger = (): readonly SchemaEvolutionStep[] =>
  DAILY_RECORD_SCHEMA_LEDGER;
