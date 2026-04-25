import type {
  ClinicalDocumentRecord,
  ClinicalDocumentVersionMeta,
  ClinicalDocumentVersionSectionSnapshot,
} from '@/features/clinical-documents/domain/entities';

export const buildClinicalDocumentVersionSectionSnapshots = (
  record: ClinicalDocumentRecord
): ClinicalDocumentVersionSectionSnapshot[] =>
  [...record.sections]
    .sort((left, right) => left.order - right.order)
    .map(section => ({
      sectionId: section.id,
      title: section.title,
      content: section.content,
      order: section.order,
      kind: section.kind,
    }));

export const resolveClinicalDocumentVersionChangedSectionIds = (
  record: ClinicalDocumentRecord,
  previousVersion?: ClinicalDocumentVersionMeta
): string[] => {
  const currentSnapshots = buildClinicalDocumentVersionSectionSnapshots(record);
  const previousById = new Map(
    (previousVersion?.sectionSnapshots || []).map(snapshot => [snapshot.sectionId, snapshot])
  );

  if (previousVersion && previousById.size === 0) {
    return [];
  }

  if (previousById.size === 0) {
    return currentSnapshots.map(snapshot => snapshot.sectionId);
  }

  return currentSnapshots
    .filter(snapshot => {
      const previous = previousById.get(snapshot.sectionId);
      return (
        !previous ||
        previous.title !== snapshot.title ||
        previous.content !== snapshot.content ||
        previous.order !== snapshot.order ||
        previous.kind !== snapshot.kind
      );
    })
    .map(snapshot => snapshot.sectionId);
};

export const getClinicalDocumentVersionChangedSectionSnapshots = (
  version: ClinicalDocumentVersionMeta
): ClinicalDocumentVersionSectionSnapshot[] => {
  const changedIds = new Set(version.changedSectionIds || []);
  const snapshots = version.sectionSnapshots || [];

  if (changedIds.size === 0) {
    return [];
  }

  return snapshots.filter(snapshot => changedIds.has(snapshot.sectionId));
};

export const withCurrentClinicalDocumentVersionSnapshotFallback = (
  record: ClinicalDocumentRecord
): ClinicalDocumentVersionMeta[] => {
  const currentSnapshots = buildClinicalDocumentVersionSectionSnapshots(record);

  return record.versionHistory.map(version => {
    if (version.version !== record.currentVersion || version.sectionSnapshots?.length) {
      return version;
    }

    return {
      ...version,
      changedSectionIds:
        version.changedSectionIds && version.changedSectionIds.length > 0
          ? version.changedSectionIds
          : [],
      sectionSnapshots: currentSnapshots,
    };
  });
};
