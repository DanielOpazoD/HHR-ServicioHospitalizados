import { expect } from 'vitest';
import type { SyncTaskContract } from '@/services/storage/syncQueueTypes';

type ClinicalSyncContractFixture = Required<
  Pick<SyncTaskContract, 'expectedVersion' | 'baseRevision' | 'changedPaths' | 'mutationId'>
>;

type ContractInput = {
  version: string;
  revision: number;
  mutationId: string;
  bedId?: string;
};

type PathsContractInput = Omit<ContractInput, 'bedId'> & {
  paths: string[];
};

type PathologyExpectationInput = {
  value: unknown;
  version: string;
  recordRevision?: string;
  bedId?: string;
};

type PathsExpectationInput = {
  value: unknown;
  version: string;
  recordRevision?: string;
  paths: string[];
};

export const createClinicalSyncPathologyContract = ({
  version,
  revision,
  mutationId,
  bedId = 'R1',
}: ContractInput): ClinicalSyncContractFixture => ({
  expectedVersion: version,
  baseRevision: revision,
  changedPaths: [`beds.${bedId}.pathology`],
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

export const createClinicalSyncPathsContract = ({
  version,
  revision,
  mutationId,
  paths,
}: PathsContractInput): ClinicalSyncContractFixture => ({
  expectedVersion: version,
  baseRevision: revision,
  changedPaths: paths,
  mutationId,
});

export const expectClinicalSyncPathologyContract = ({
  value,
  version,
  recordRevision,
  bedId = 'R1',
}: PathologyExpectationInput): void => {
  expect(value).toEqual(
    expect.objectContaining({
      expectedVersion: version,
      ...(recordRevision ? { recordRevision } : {}),
      changedPaths: expect.arrayContaining([`beds.${bedId}.pathology`]),
    })
  );
};

export const expectClinicalSyncPathsContract = ({
  value,
  version,
  recordRevision,
  paths,
}: PathsExpectationInput): void => {
  expect(value).toEqual(
    expect.objectContaining({
      expectedVersion: version,
      ...(recordRevision ? { recordRevision } : {}),
      changedPaths: paths,
    })
  );
};
