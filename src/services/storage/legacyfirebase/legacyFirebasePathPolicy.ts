import {
  LEGACY_DISCOVERY_COLLECTION_PATHS,
  LEGACY_NURSES_DOC_PATHS,
  LEGACY_RECORD_COLLECTION_PATHS,
  LEGACY_RECORD_DOC_PATHS,
  LEGACY_TENS_DOC_PATHS,
} from './legacyFirebasePaths';

export interface LegacyFirebasePathSnapshot {
  recordDocPaths: string[];
  recordCollectionPaths: string[];
  discoveryCollectionPaths: string[];
  nursesDocPaths: string[];
  tensDocPaths: string[];
}

export const getLegacyFirebasePathSnapshot = (date: string): LegacyFirebasePathSnapshot => ({
  recordDocPaths: LEGACY_RECORD_DOC_PATHS(date),
  recordCollectionPaths: [...LEGACY_RECORD_COLLECTION_PATHS],
  discoveryCollectionPaths: [...LEGACY_DISCOVERY_COLLECTION_PATHS],
  nursesDocPaths: [...LEGACY_NURSES_DOC_PATHS],
  tensDocPaths: [...LEGACY_TENS_DOC_PATHS],
});
