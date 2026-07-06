import { expect } from 'vitest';

type ClinicalSyncContractFixture = {
  expectedVersion: string;
  baseRevision: number;
  changedPaths: string[];
  mutationId: string;
};

type ContractInput = {
  version: string;
  revision: number;
  mutationId: string;
};

type PathologyExpectationInput = {
  value: unknown;
  version: string;
  recordRevision?: string;
};

export const createClinicalSyncPathologyContract = ({
  version,
  revision,
  mutationId,
}: ContractInput): ClinicalSyncContractFixture => ({
  expectedVersion: version,
  baseRevision: revision,
  changedPaths: ['beds.R1.pathology'],
  mutationId,
});

export const createClinicalSyncFullSaveContract = ({
  version,
  revision,
  mutationId,
}: ContractInput): ClinicalSyncContractFixture => ({
  expectedVersion: version,
  baseRevision: revision,
  changedPaths: ['*'],
  mutationId,
});

export const expectClinicalSyncPathologyContract = ({
  value,
  version,
  recordRevision,
}: PathologyExpectationInput): void => {
  expect(value).toEqual(
    expect.objectContaining({
      expectedVersion: version,
      ...(recordRevision ? { recordRevision } : {}),
      changedPaths: expect.arrayContaining(['beds.R1.pathology']),
    })
  );
};
