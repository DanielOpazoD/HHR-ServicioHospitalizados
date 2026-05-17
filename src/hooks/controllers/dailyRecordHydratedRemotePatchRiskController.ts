import type { DailyRecord, DailyRecordPatch } from '@/application/shared/dailyRecordCoreContracts';

export type HydratedRemotePatchRisk =
  | 'independent_field'
  | 'same_field'
  | 'same_group'
  | 'episode_changed'
  | 'movement_changed'
  | 'unknown_high_risk';

export interface HydratedRemoteClinicalFieldLocks {
  diagnosis?: boolean;
  status?: boolean;
  specialty?: boolean;
  upc?: boolean;
  surgicalComplication?: boolean;
  allClinical?: boolean;
}

export type HydratedRemoteClinicalFieldLocksByBedId = Record<
  string,
  HydratedRemoteClinicalFieldLocks
>;

const CLINICAL_FIELD_GROUPS: ReadonlyArray<ReadonlySet<string>> = [
  new Set(['pathology', 'cie10Code', 'cie10Description', 'diagnosisComments']),
  new Set(['status']),
  new Set(['specialty', 'secondarySpecialty']),
  new Set(['isUPC', 'upcChecklist']),
  new Set(['surgicalComplication']),
  new Set([
    'ginecobstetriciaType',
    'deliveryDate',
    'deliveryRoute',
    'deliveryCesareanLabor',
    'clinicalCrib',
  ]),
];

const EPISODE_FIELDS = new Set([
  'clinicalEpisodeId',
  'rut',
  'patientName',
  'admissionDate',
  'firstSeenDate',
]);

const getPathValue = (source: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, source);

const valuesDiffer = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left ?? null) !== JSON.stringify(right ?? null);

const parseBedPatchPath = (
  path: string
): { bedId: string; field?: string; canonicalPath?: string } | null => {
  const bedMatch = path.match(/^beds\.([^.]+)$/);
  if (bedMatch) {
    return {
      bedId: bedMatch[1],
    };
  }

  const fieldMatch = path.match(/^beds\.([^.]+)\.([^.]+)/);
  if (!fieldMatch) {
    return null;
  }
  const [, bedId, field] = fieldMatch;
  return {
    bedId,
    field,
    canonicalPath: `beds.${bedId}.${field}`,
  };
};

const resolveClinicalGroup = (field: string): ReadonlySet<string> | null =>
  CLINICAL_FIELD_GROUPS.find(group => group.has(field)) ?? null;

const resolveClinicalLockKey = (field: string): keyof HydratedRemoteClinicalFieldLocks | null => {
  if (['pathology', 'cie10Code', 'cie10Description', 'diagnosisComments'].includes(field)) {
    return 'diagnosis';
  }
  if (field === 'status') {
    return 'status';
  }
  if (field === 'specialty' || field === 'secondarySpecialty') {
    return 'specialty';
  }
  if (field === 'isUPC' || field === 'upcChecklist') {
    return 'upc';
  }
  if (field === 'surgicalComplication') {
    return 'surgicalComplication';
  }
  if (
    [
      'ginecobstetriciaType',
      'deliveryDate',
      'deliveryRoute',
      'deliveryCesareanLabor',
      'clinicalCrib',
    ].includes(field)
  ) {
    return 'diagnosis';
  }
  return null;
};

const collectChangedBedFields = (
  previousRecord: DailyRecord,
  hydratedRecord: DailyRecord,
  bedId: string
): Set<string> => {
  const fields = new Set<string>();
  const previousBed = (previousRecord.beds?.[bedId] ?? {}) as unknown as Record<string, unknown>;
  const hydratedBed = (hydratedRecord.beds?.[bedId] ?? {}) as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(previousBed), ...Object.keys(hydratedBed)]);

  keys.forEach(field => {
    if (valuesDiffer(previousBed[field], hydratedBed[field])) {
      fields.add(field);
    }
  });

  return fields;
};

export const classifyHydratedRemotePatchRisk = ({
  attemptedPatch,
  previousRecord,
  hydratedRecord,
}: {
  attemptedPatch: DailyRecordPatch;
  previousRecord: DailyRecord | null | undefined;
  hydratedRecord: DailyRecord | null | undefined;
}): HydratedRemotePatchRisk => {
  if (!previousRecord || !hydratedRecord) {
    return 'unknown_high_risk';
  }

  if (
    valuesDiffer(previousRecord.discharges, hydratedRecord.discharges) ||
    valuesDiffer(previousRecord.transfers, hydratedRecord.transfers)
  ) {
    return 'movement_changed';
  }

  const attemptedPaths = Object.keys(attemptedPatch);
  for (const attemptedPath of attemptedPaths) {
    const attemptedBedPatch = parseBedPatchPath(attemptedPath);
    if (!attemptedBedPatch) {
      return 'unknown_high_risk';
    }

    const changedFields = collectChangedBedFields(
      previousRecord,
      hydratedRecord,
      attemptedBedPatch.bedId
    );
    if (Array.from(EPISODE_FIELDS).some(field => changedFields.has(field))) {
      return 'episode_changed';
    }

    if (!attemptedBedPatch.field) {
      if (changedFields.size > 0) {
        return Array.from(changedFields).some(field => resolveClinicalGroup(field))
          ? 'same_group'
          : 'unknown_high_risk';
      }
      continue;
    }

    if (
      attemptedBedPatch.canonicalPath &&
      valuesDiffer(
        getPathValue(previousRecord, attemptedBedPatch.canonicalPath),
        getPathValue(hydratedRecord, attemptedBedPatch.canonicalPath)
      )
    ) {
      return 'same_field';
    }

    const attemptedGroup = resolveClinicalGroup(attemptedBedPatch.field);
    if (attemptedGroup && Array.from(attemptedGroup).some(field => changedFields.has(field))) {
      return 'same_group';
    }
  }

  return 'independent_field';
};

export const isHydratedRemotePatchRiskBlocking = (risk: HydratedRemotePatchRisk): boolean =>
  risk !== 'independent_field';

export const buildHydratedRemoteClinicalFieldLocks = ({
  previousRecord,
  hydratedRecord,
}: {
  previousRecord: DailyRecord | null | undefined;
  hydratedRecord: DailyRecord | null | undefined;
}): HydratedRemoteClinicalFieldLocksByBedId => {
  if (!previousRecord || !hydratedRecord) {
    return {};
  }

  const bedIds = new Set([
    ...Object.keys(previousRecord.beds ?? {}),
    ...Object.keys(hydratedRecord.beds ?? {}),
  ]);
  const locksByBedId: HydratedRemoteClinicalFieldLocksByBedId = {};

  bedIds.forEach(bedId => {
    const changedFields = collectChangedBedFields(previousRecord, hydratedRecord, bedId);
    if (changedFields.size === 0) {
      return;
    }

    const locks: HydratedRemoteClinicalFieldLocks = {};
    if (Array.from(EPISODE_FIELDS).some(field => changedFields.has(field))) {
      locks.allClinical = true;
    }

    changedFields.forEach(field => {
      const lockKey = resolveClinicalLockKey(field);
      if (lockKey) {
        locks[lockKey] = true;
      }
    });

    if (Object.keys(locks).length > 0) {
      locksByBedId[bedId] = locks;
    }
  });

  return locksByBedId;
};
