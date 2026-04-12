import {
  CLIENT_RUNTIME_CONTRACT_VERSION,
  MIN_SUPPORTED_BACKEND_RUNTIME_CONTRACT_VERSION,
} from '@/constants/runtimeContracts';
import { CURRENT_SCHEMA_VERSION, LEGACY_SCHEMA_VERSION } from '@/constants/version';

export interface RemoteRuntimeContract {
  backendRuntimeContractVersion: number;
  minSupportedClientRuntimeContractVersion: number;
  supportedSchemaVersion: number;
  legacySchemaFloorVersion: number;
}

export type RemoteRuntimeContractDisposition =
  | 'compatible'
  | 'runtime_contract_mismatch'
  | 'schema_ahead_of_client';

export interface RemoteRuntimeContractAssessment {
  ok: boolean;
  disposition: RemoteRuntimeContractDisposition;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isJsonContentType = (contentType: string | null): boolean =>
  typeof contentType === 'string' && contentType.toLowerCase().includes('application/json');

export const assessRemoteRuntimeContract = (
  contract: RemoteRuntimeContract
): RemoteRuntimeContractAssessment => {
  if (
    contract.backendRuntimeContractVersion < MIN_SUPPORTED_BACKEND_RUNTIME_CONTRACT_VERSION ||
    CLIENT_RUNTIME_CONTRACT_VERSION < contract.minSupportedClientRuntimeContractVersion ||
    contract.legacySchemaFloorVersion !== LEGACY_SCHEMA_VERSION
  ) {
    return {
      ok: false,
      disposition: 'runtime_contract_mismatch',
    };
  }

  if (contract.supportedSchemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      disposition: 'schema_ahead_of_client',
    };
  }

  return {
    ok: true,
    disposition: 'compatible',
  };
};

export const fetchRemoteRuntimeContract = async (): Promise<RemoteRuntimeContract | null> => {
  if (typeof fetch === 'undefined') {
    return null;
  }

  const response = await fetch(`/.netlify/functions/runtime-contract?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }

    throw new Error(`Runtime contract request failed (${response.status})`);
  }

  const contentType = response.headers.get('content-type');
  if (!isJsonContentType(contentType)) {
    return null;
  }

  let payload: Partial<RemoteRuntimeContract>;
  try {
    payload = (await response.json()) as Partial<RemoteRuntimeContract>;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }

  if (
    !isFiniteNumber(payload.backendRuntimeContractVersion) ||
    !isFiniteNumber(payload.minSupportedClientRuntimeContractVersion) ||
    !isFiniteNumber(payload.supportedSchemaVersion) ||
    !isFiniteNumber(payload.legacySchemaFloorVersion)
  ) {
    throw new Error('Runtime contract response is incomplete');
  }

  return {
    backendRuntimeContractVersion: payload.backendRuntimeContractVersion,
    minSupportedClientRuntimeContractVersion: payload.minSupportedClientRuntimeContractVersion,
    supportedSchemaVersion: payload.supportedSchemaVersion,
    legacySchemaFloorVersion: payload.legacySchemaFloorVersion,
  };
};
