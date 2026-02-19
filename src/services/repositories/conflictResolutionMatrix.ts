import { DailyRecord, DailyRecordPatch, PatientData } from '@/types';
import { applyPatches } from '@/utils/patchUtils';

interface ConflictResolutionOptions {
  changedPaths?: string[];
}

const ID_BASED_ARRAY_FIELDS = new Set(['discharges', 'transfers', 'cma']);
const UNIQUE_ARRAY_FIELDS = new Set([
  'nurses',
  'nursesDayShift',
  'nursesNightShift',
  'tensDayShift',
  'tensNightShift',
  'activeExtraBeds',
]);
const PATIENT_ID_ARRAY_FIELDS = new Set(['clinicalEvents', 'deviceInstanceHistory']);
const PATIENT_UNIQUE_ARRAY_FIELDS = new Set(['devices']);

export const resolveDailyRecordConflict = (
  remote: DailyRecord,
  local: DailyRecord,
  options: ConflictResolutionOptions = {}
): DailyRecord => {
  const changedPaths = normalizeChangedPaths(options.changedPaths);
  if (changedPaths.length === 0 || changedPaths.includes('*')) {
    return resolveWholeRecord(remote, local);
  }
  return resolveByChangedPaths(remote, local, changedPaths);
};

const resolveWholeRecord = (remote: DailyRecord, local: DailyRecord): DailyRecord => {
  const localTs = toMillis(local.lastUpdated);
  const remoteTs = toMillis(remote.lastUpdated);
  const preferLocal = localTs >= remoteTs;
  const preferred = preferLocal ? local : remote;
  const secondary = preferLocal ? remote : local;

  const resolved: DailyRecord = {
    ...secondary,
    ...preferred,
    date: remote.date || local.date,
    beds: mergeBeds(remote.beds, local.beds, preferLocal),
    discharges: mergeArrayById(remote.discharges, local.discharges),
    transfers: mergeArrayById(remote.transfers, local.transfers),
    cma: mergeArrayById(remote.cma, local.cma),
    nurses: mergeUniquePrimitiveArray(remote.nurses, local.nurses, preferLocal),
    nursesDayShift: mergeUniquePrimitiveArray(
      remote.nursesDayShift || [],
      local.nursesDayShift || [],
      preferLocal
    ),
    nursesNightShift: mergeUniquePrimitiveArray(
      remote.nursesNightShift || [],
      local.nursesNightShift || [],
      preferLocal
    ),
    tensDayShift: mergeUniquePrimitiveArray(
      remote.tensDayShift || [],
      local.tensDayShift || [],
      preferLocal
    ),
    tensNightShift: mergeUniquePrimitiveArray(
      remote.tensNightShift || [],
      local.tensNightShift || [],
      preferLocal
    ),
    activeExtraBeds: mergeUniquePrimitiveArray(
      remote.activeExtraBeds || [],
      local.activeExtraBeds || [],
      preferLocal
    ),
    handoffDayChecklist: mergeObject(
      remote.handoffDayChecklist as unknown as Record<string, unknown> | undefined,
      local.handoffDayChecklist as unknown as Record<string, unknown> | undefined,
      preferLocal
    ) as DailyRecord['handoffDayChecklist'],
    handoffNightChecklist: mergeObject(
      remote.handoffNightChecklist as unknown as Record<string, unknown> | undefined,
      local.handoffNightChecklist as unknown as Record<string, unknown> | undefined,
      preferLocal
    ) as DailyRecord['handoffNightChecklist'],
    medicalSignature: mergeObject(
      remote.medicalSignature as unknown as Record<string, unknown> | undefined,
      local.medicalSignature as unknown as Record<string, unknown> | undefined,
      preferLocal
    ) as DailyRecord['medicalSignature'],
    lastUpdated: toIso(Math.max(remoteTs, localTs)),
  };

  return resolved;
};

const resolveByChangedPaths = (
  remote: DailyRecord,
  local: DailyRecord,
  changedPaths: string[]
): DailyRecord => {
  const patches: DailyRecordPatch = {};

  for (const path of changedPaths) {
    if (path === '*') {
      return resolveWholeRecord(remote, local);
    }

    const [root, second, third] = path.split('.');

    if (root === 'beds') {
      if (!second) {
        (patches as Record<string, unknown>).beds = mergeBeds(remote.beds, local.beds, true);
        continue;
      }

      if (!third) {
        const remoteBed = remote.beds[second];
        const localBed = local.beds[second];
        (patches as Record<string, unknown>)[`beds.${second}`] = mergePatientData(
          remoteBed,
          localBed,
          true
        );
        continue;
      }

      const patchValue = resolvePathValueWithMatrix(remote, local, path);
      (patches as Record<string, unknown>)[path] = patchValue;
      continue;
    }

    if (ID_BASED_ARRAY_FIELDS.has(root)) {
      const remoteMap = remote as unknown as Record<string, unknown>;
      const localMap = local as unknown as Record<string, unknown>;
      (patches as Record<string, unknown>)[root] = mergeArrayById(
        remoteMap[root] as unknown[],
        localMap[root] as unknown[]
      );
      continue;
    }

    if (UNIQUE_ARRAY_FIELDS.has(root)) {
      const remoteMap = remote as unknown as Record<string, unknown>;
      const localMap = local as unknown as Record<string, unknown>;
      (patches as Record<string, unknown>)[root] = mergeUniquePrimitiveArray(
        (remoteMap[root] as string[]) || [],
        (localMap[root] as string[]) || [],
        true
      );
      continue;
    }

    (patches as Record<string, unknown>)[path] = getValueAtPath(local, path);
  }

  const merged = applyPatches(remote, patches);
  merged.lastUpdated = toIso(Math.max(toMillis(remote.lastUpdated), toMillis(local.lastUpdated)));
  return merged;
};

const resolvePathValueWithMatrix = (
  remote: DailyRecord,
  local: DailyRecord,
  path: string
): unknown => {
  const parts = path.split('.');
  const bedId = parts[1];
  const patientField = parts[2];

  if (!bedId || !patientField) {
    return getValueAtPath(local, path);
  }

  if (PATIENT_ID_ARRAY_FIELDS.has(patientField)) {
    return mergeArrayById(
      getValueAtPath(remote, path) as unknown[],
      getValueAtPath(local, path) as unknown[]
    );
  }

  if (PATIENT_UNIQUE_ARRAY_FIELDS.has(patientField)) {
    return mergeUniquePrimitiveArray(
      (getValueAtPath(remote, path) as string[]) || [],
      (getValueAtPath(local, path) as string[]) || [],
      true
    );
  }

  return getValueAtPath(local, path);
};

const mergeBeds = (
  remoteBeds: Record<string, PatientData>,
  localBeds: Record<string, PatientData>,
  preferLocal: boolean
): Record<string, PatientData> => {
  const merged: Record<string, PatientData> = {};
  const bedIds = new Set([...Object.keys(remoteBeds || {}), ...Object.keys(localBeds || {})]);

  bedIds.forEach(bedId => {
    merged[bedId] = mergePatientData(remoteBeds?.[bedId], localBeds?.[bedId], preferLocal);
  });

  return merged;
};

const mergePatientData = (
  remotePatient: PatientData | undefined,
  localPatient: PatientData | undefined,
  preferLocal: boolean
): PatientData => {
  if (!remotePatient && localPatient) return localPatient;
  if (!localPatient && remotePatient) return remotePatient;
  if (!remotePatient && !localPatient) {
    return {} as PatientData;
  }

  const remoteRecord = remotePatient as unknown as Record<string, unknown>;
  const localRecord = localPatient as unknown as Record<string, unknown>;
  const merged: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(remoteRecord), ...Object.keys(localRecord)]);

  keys.forEach(key => {
    const remoteValue = remoteRecord[key];
    const localValue = localRecord[key];

    if (PATIENT_ID_ARRAY_FIELDS.has(key)) {
      merged[key] = mergeArrayById(
        (remoteValue as unknown[]) || [],
        (localValue as unknown[]) || []
      );
      return;
    }

    if (PATIENT_UNIQUE_ARRAY_FIELDS.has(key)) {
      merged[key] = mergeUniquePrimitiveArray(
        (remoteValue as string[]) || [],
        (localValue as string[]) || [],
        preferLocal
      );
      return;
    }

    if (key === 'clinicalCrib') {
      merged[key] = mergePatientData(
        remoteValue as PatientData | undefined,
        localValue as PatientData | undefined,
        preferLocal
      );
      return;
    }

    merged[key] = mergeUnknown(remoteValue, localValue, preferLocal);
  });

  return merged as unknown as PatientData;
};

const mergeUnknown = (remote: unknown, local: unknown, preferLocal: boolean): unknown => {
  if (Array.isArray(remote) || Array.isArray(local)) {
    const remoteArray = Array.isArray(remote) ? remote : [];
    const localArray = Array.isArray(local) ? local : [];
    if (remoteArray.length > 0 && typeof remoteArray[0] === 'object') {
      return mergeArrayById(remoteArray, localArray);
    }
    return mergeUniquePrimitiveArray(
      remoteArray.filter(isPrimitive).map(String),
      localArray.filter(isPrimitive).map(String),
      preferLocal
    );
  }

  if (isPlainObject(remote) || isPlainObject(local)) {
    return mergeObject(
      (isPlainObject(remote) ? remote : {}) as Record<string, unknown>,
      (isPlainObject(local) ? local : {}) as Record<string, unknown>,
      preferLocal
    );
  }

  if (preferLocal) {
    return local === undefined ? remote : local;
  }
  return remote === undefined ? local : remote;
};

const mergeObject = (
  remote: Record<string, unknown> | undefined,
  local: Record<string, unknown> | undefined,
  preferLocal: boolean
): Record<string, unknown> | undefined => {
  if (!remote && !local) return undefined;
  if (!remote) return local;
  if (!local) return remote;

  const result: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(remote), ...Object.keys(local)]);

  keys.forEach(key => {
    result[key] = mergeUnknown(remote[key], local[key], preferLocal);
  });

  return result;
};

const mergeArrayById = <T>(remote: T[] = [], local: T[] = []): T[] => {
  const output = new Map<string, T>();
  const sequence: string[] = [];

  const append = (item: T) => {
    const id = resolveItemId(item);
    if (!output.has(id)) {
      sequence.push(id);
    }
    output.set(id, item);
  };

  remote.forEach(append);
  local.forEach(append);

  return sequence.map(id => output.get(id) as T);
};

const mergeUniquePrimitiveArray = (
  remote: string[] = [],
  local: string[] = [],
  preferLocal: boolean
): string[] => {
  const preferred = preferLocal ? local : remote;
  const secondary = preferLocal ? remote : local;
  return Array.from(new Set([...(preferred || []), ...(secondary || [])]));
};

const resolveItemId = (item: unknown): string => {
  if (item && typeof item === 'object' && 'id' in item) {
    return String((item as { id?: string | number }).id ?? JSON.stringify(item));
  }
  return JSON.stringify(item);
};

const getValueAtPath = (source: unknown, path: string): unknown => {
  const parts = path.split('.');
  let cursor: unknown = source;

  for (const part of parts) {
    if (cursor == null) {
      return undefined;
    }
    if (Array.isArray(cursor)) {
      const index = Number(part);
      cursor = Number.isNaN(index) ? undefined : cursor[index];
      continue;
    }
    if (typeof cursor === 'object') {
      cursor = (cursor as Record<string, unknown>)[part];
      continue;
    }
    return undefined;
  }

  return cursor;
};

const normalizeChangedPaths = (changedPaths?: string[]): string[] => {
  if (!changedPaths || changedPaths.length === 0) return [];
  return Array.from(new Set(changedPaths.map(path => path.trim()).filter(Boolean)));
};

const toMillis = (value: string | undefined): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toIso = (value: number): string => new Date(value || Date.now()).toISOString();

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isPrimitive = (value: unknown): value is string | number | boolean =>
  ['string', 'number', 'boolean'].includes(typeof value);
