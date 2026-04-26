import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const VIEW_CONTRACTS_PATH = 'src/features/census/components/patient-row/patientRowViewContracts.ts';

describe('Patient row view contracts governance', () => {
  it('keeps patientRowViewContracts as a compatibility barrel', () => {
    const content = readFileSync(VIEW_CONTRACTS_PATH, 'utf8');

    expect(content).not.toMatch(/export interface\s+/);
    expect(content).toMatch(/export type \{[^}]*PatientInputCellsProps/s);
    expect(content).toMatch(/export type \{[^}]*PatientMainRowViewProps/s);
    expect(content).toMatch(/export type \{[^}]*PatientRowModalsProps/s);
  });
});
