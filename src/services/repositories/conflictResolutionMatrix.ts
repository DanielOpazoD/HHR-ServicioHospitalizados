import { DailyRecord, DailyRecordPatch, PatientData } from '@/types';
import { applyPatches } from '@/utils/patchUtils';
import {
  CONFLICT_RESOLUTION_POLICY_VERSION,
  RECORD_STRUCTURAL_FIELDS,
  decideScalarByPolicy,
} from '@/services/repositories/conflictResolutionPolicy';
import {
  getValueAtPath,
  isPlainObject,
  isPrimitive,
  normalizeChangedPaths,
  toIso,
  toMillis,
} from '@/services/repositories/conflictResolutionUtils';
import {
  ConflictResolutionTrace,
  ConflictResolutionTraceContext,
  createConflictResolutionTraceContext,
  traceFromScalarDecision,
} from '@/services/repositories/conflictResolutionTrace';

interface ConflictResolutionOptions {
  changedPaths?: string[];
}

export interface ConflictResolutionResult {
  record: DailyRecord;
  trace: ConflictResolutionTrace;
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
  return resolveDailyRecordConflictWithTrace(remote, local, options).record;
};

export const resolveDailyRecordConflictWithTrace = (
  remote: DailyRecord,
  local: DailyRecord,
  options: ConflictResolutionOptions = {}
): ConflictResolutionResult => {
  const traceContext = createConflictResolutionTraceContext();
  const changedPaths = normalizeChangedPaths(options.changedPaths);
  if (changedPaths.length === 0 || changedPaths.includes('*')) {
    return {
      record: resolveWholeRecord(remote, local, traceContext),
      trace: {
        policyVersion: CONFLICT_RESOLUTION_POLICY_VERSION,
        entries: traceContext.entries,
      },
    };
  }
  return {
    record: resolveByChangedPaths(remote, local, changedPaths, traceContext),
    trace: {
      policyVersion: CONFLICT_RESOLUTION_POLICY_VERSION,
      entries: traceContext.entries,
    },
  };
};

const resolveWholeRecord = (
  remote: DailyRecord,
  local: DailyRecord,
  traceContext: ConflictResolutionTraceContext
): DailyRecord => {
  const localTs = toMillis(local.lastUpdated);
  const remoteTs = toMillis(remote.lastUpdated);
  const preferLocal = localTs >= remoteTs;
  const preferred = preferLocal ? local : remote;
  const secondary = preferLocal ? remote : local;

  const resolved: DailyRecord = {
    ...secondary,
    ...preferred,
    date: remote.date || local.date,
    beds: mergeBeds(remote.beds, local.beds, preferLocal, traceContext, 'beds'),
    discharges: mergeArrayById(remote.discharges, local.discharges, traceContext, 'discharges'),
    transfers: mergeArrayById(remote.transfers, local.transfers, traceContext, 'transfers'),
    cma: mergeArrayById(remote.cma, local.cma, traceContext, 'cma'),
    nurses: mergeUniquePrimitiveArray(
      remote.nurses,
      local.nurses,
      preferLocal,
      traceContext,
      'nurses'
    ),
    nursesDayShift: mergeUniquePrimitiveArray(
      remote.nursesDayShift || [],
      local.nursesDayShift || [],
      preferLocal,
      traceContext,
      'nursesDayShift'
    ),
    nursesNightShift: mergeUniquePrimitiveArray(
      remote.nursesNightShift || [],
      local.nursesNightShift || [],
      preferLocal,
      traceContext,
      'nursesNightShift'
    ),
    tensDayShift: mergeUniquePrimitiveArray(
      remote.tensDayShift || [],
      local.tensDayShift || [],
      preferLocal,
      traceContext,
      'tensDayShift'
    ),
    tensNightShift: mergeUniquePrimitiveArray(
      remote.tensNightShift || [],
      local.tensNightShift || [],
      preferLocal,
      traceContext,
      'tensNightShift'
    ),
    activeExtraBeds: mergeUniquePrimitiveArray(
      remote.activeExtraBeds || [],
      local.activeExtraBeds || [],
      preferLocal,
      traceContext,
      'activeExtraBeds'
    ),
    handoffDayChecklist: mergeObject(
      remote.handoffDayChecklist as unknown as Record<string, unknown> | undefined,
      local.handoffDayChecklist as unknown as Record<string, unknown> | undefined,
      preferLocal,
      traceContext,
      'handoffDayChecklist'
    ) as DailyRecord['handoffDayChecklist'],
    handoffNightChecklist: mergeObject(
      remote.handoffNightChecklist as unknown as Record<string, unknown> | undefined,
      local.handoffNightChecklist as unknown as Record<string, unknown> | undefined,
      preferLocal,
      traceContext,
      'handoffNightChecklist'
    ) as DailyRecord['handoffNightChecklist'],
    medicalSignature: mergeObject(
      remote.medicalSignature as unknown as Record<string, unknown> | undefined,
      local.medicalSignature as unknown as Record<string, unknown> | undefined,
      preferLocal,
      traceContext,
      'medicalSignature'
    ) as DailyRecord['medicalSignature'],
    lastUpdated: toIso(Math.max(remoteTs, localTs)),
  };

  const remoteRecord = remote as unknown as Record<string, unknown>;
  const localRecord = local as unknown as Record<string, unknown>;
  const scalarKeys = new Set([...Object.keys(remoteRecord), ...Object.keys(localRecord)]);
  scalarKeys.forEach(key => {
    if (RECORD_STRUCTURAL_FIELDS.has(key)) return;
    const decision = decideScalarByPolicy(key, remoteRecord[key], localRecord[key], preferLocal);
    (resolved as unknown as Record<string, unknown>)[key] = decision.value;
    traceContext.add(traceFromScalarDecision(key, decision));
  });

  return resolved;
};

const resolveByChangedPaths = (
  remote: DailyRecord,
  local: DailyRecord,
  changedPaths: string[],
  traceContext: ConflictResolutionTraceContext
): DailyRecord => {
  const patches: DailyRecordPatch = {};

  for (const path of changedPaths) {
    if (path === '*') {
      return resolveWholeRecord(remote, local, traceContext);
    }

    const [root, second, third] = path.split('.');

    if (root === 'beds') {
      if (!second) {
        (patches as Record<string, unknown>).beds = mergeBeds(
          remote.beds,
          local.beds,
          true,
          traceContext,
          'beds'
        );
        continue;
      }

      if (!third) {
        const remoteBed = remote.beds[second];
        const localBed = local.beds[second];
        (patches as Record<string, unknown>)[`beds.${second}`] = mergePatientData(
          remoteBed,
          localBed,
          true,
          traceContext,
          `beds.${second}`
        );
        continue;
      }

      const patchValue = resolvePathValueWithMatrix(remote, local, path, traceContext);
      (patches as Record<string, unknown>)[path] = patchValue;
      continue;
    }

    if (ID_BASED_ARRAY_FIELDS.has(root)) {
      const remoteMap = remote as unknown as Record<string, unknown>;
      const localMap = local as unknown as Record<string, unknown>;
      (patches as Record<string, unknown>)[root] = mergeArrayById(
        remoteMap[root] as unknown[],
        localMap[root] as unknown[],
        traceContext,
        root
      );
      continue;
    }

    if (UNIQUE_ARRAY_FIELDS.has(root)) {
      const remoteMap = remote as unknown as Record<string, unknown>;
      const localMap = local as unknown as Record<string, unknown>;
      (patches as Record<string, unknown>)[root] = mergeUniquePrimitiveArray(
        (remoteMap[root] as string[]) || [],
        (localMap[root] as string[]) || [],
        true,
        traceContext,
        root
      );
      continue;
    }

    const decision = decideScalarByPolicy(
      path,
      getValueAtPath(remote, path),
      getValueAtPath(local, path),
      true
    );
    (patches as Record<string, unknown>)[path] = decision.value;
    traceContext.add(traceFromScalarDecision(path, decision));
  }

  const merged = applyPatches(remote, patches);
  merged.lastUpdated = toIso(Math.max(toMillis(remote.lastUpdated), toMillis(local.lastUpdated)));
  return merged;
};

const resolvePathValueWithMatrix = (
  remote: DailyRecord,
  local: DailyRecord,
  path: string,
  traceContext: ConflictResolutionTraceContext
): unknown => {
  const parts = path.split('.');
  const bedId = parts[1];
  const patientField = parts[2];

  if (!bedId || !patientField) {
    const decision = decideScalarByPolicy(
      path,
      getValueAtPath(remote, path),
      getValueAtPath(local, path),
      true
    );
    traceContext.add(traceFromScalarDecision(path, decision));
    return decision.value;
  }

  if (PATIENT_ID_ARRAY_FIELDS.has(patientField)) {
    return mergeArrayById(
      getValueAtPath(remote, path) as unknown[],
      getValueAtPath(local, path) as unknown[],
      traceContext,
      path
    );
  }

  if (PATIENT_UNIQUE_ARRAY_FIELDS.has(patientField)) {
    return mergeUniquePrimitiveArray(
      (getValueAtPath(remote, path) as string[]) || [],
      (getValueAtPath(local, path) as string[]) || [],
      true,
      traceContext,
      path
    );
  }

  const decision = decideScalarByPolicy(
    path,
    getValueAtPath(remote, path),
    getValueAtPath(local, path),
    true
  );
  traceContext.add(traceFromScalarDecision(path, decision));
  return decision.value;
};

const mergeBeds = (
  remoteBeds: Record<string, PatientData>,
  localBeds: Record<string, PatientData>,
  preferLocal: boolean,
  traceContext?: ConflictResolutionTraceContext,
  pathPrefix = 'beds'
): Record<string, PatientData> => {
  const merged: Record<string, PatientData> = {};
  const bedIds = new Set([...Object.keys(remoteBeds || {}), ...Object.keys(localBeds || {})]);
  traceContext?.add({
    path: pathPrefix,
    strategy: 'merge_beds',
    winner: 'merged',
    reason: 'merge_union_by_bed_id',
  });

  bedIds.forEach(bedId => {
    merged[bedId] = mergePatientData(
      remoteBeds?.[bedId],
      localBeds?.[bedId],
      preferLocal,
      traceContext,
      `beds.${bedId}`
    );
  });

  return merged;
};

const mergePatientData = (
  remotePatient: PatientData | undefined,
  localPatient: PatientData | undefined,
  preferLocal: boolean,
  traceContext?: ConflictResolutionTraceContext,
  pathPrefix = 'beds'
): PatientData => {
  if (!remotePatient && localPatient) {
    traceContext?.add({
      path: pathPrefix,
      strategy: 'copy_local_value',
      winner: 'local',
      reason: 'remote_patient_missing',
    });
    return localPatient;
  }
  if (!localPatient && remotePatient) {
    traceContext?.add({
      path: pathPrefix,
      strategy: 'copy_local_value',
      winner: 'remote',
      reason: 'local_patient_missing',
    });
    return remotePatient;
  }
  if (!remotePatient && !localPatient) {
    return {} as PatientData;
  }

  const remoteRecord = remotePatient as unknown as Record<string, unknown>;
  const localRecord = localPatient as unknown as Record<string, unknown>;
  const merged: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(remoteRecord), ...Object.keys(localRecord)]);
  traceContext?.add({
    path: pathPrefix,
    strategy: 'merge_patient',
    winner: 'merged',
    reason: 'merge_patient_fields',
  });

  keys.forEach(key => {
    const remoteValue = remoteRecord[key];
    const localValue = localRecord[key];

    if (PATIENT_ID_ARRAY_FIELDS.has(key)) {
      merged[key] = mergeArrayById(
        (remoteValue as unknown[]) || [],
        (localValue as unknown[]) || [],
        traceContext,
        `${pathPrefix}.${key}`
      );
      return;
    }

    if (PATIENT_UNIQUE_ARRAY_FIELDS.has(key)) {
      merged[key] = mergeUniquePrimitiveArray(
        (remoteValue as string[]) || [],
        (localValue as string[]) || [],
        preferLocal,
        traceContext,
        `${pathPrefix}.${key}`
      );
      return;
    }

    if (key === 'clinicalCrib') {
      merged[key] = mergePatientData(
        remoteValue as PatientData | undefined,
        localValue as PatientData | undefined,
        preferLocal,
        traceContext,
        `${pathPrefix}.${key}`
      );
      return;
    }

    merged[key] = mergeUnknown(
      remoteValue,
      localValue,
      preferLocal,
      `${pathPrefix}.${key}`,
      traceContext
    );
  });

  return merged as unknown as PatientData;
};

const mergeUnknown = (
  remote: unknown,
  local: unknown,
  preferLocal: boolean,
  path = '',
  traceContext?: ConflictResolutionTraceContext
): unknown => {
  if (Array.isArray(remote) || Array.isArray(local)) {
    const remoteArray = Array.isArray(remote) ? remote : [];
    const localArray = Array.isArray(local) ? local : [];
    if (remoteArray.length > 0 && typeof remoteArray[0] === 'object') {
      return mergeArrayById(remoteArray, localArray, traceContext, path);
    }
    return mergeUniquePrimitiveArray(
      remoteArray.filter(isPrimitive).map(String),
      localArray.filter(isPrimitive).map(String),
      preferLocal,
      traceContext,
      path
    );
  }

  if (isPlainObject(remote) || isPlainObject(local)) {
    return mergeObject(
      (isPlainObject(remote) ? remote : {}) as Record<string, unknown>,
      (isPlainObject(local) ? local : {}) as Record<string, unknown>,
      preferLocal,
      traceContext,
      path
    );
  }
  const decision = decideScalarByPolicy(path, remote, local, preferLocal);
  traceContext?.add(traceFromScalarDecision(path, decision));
  return decision.value;
};

const mergeObject = (
  remote: Record<string, unknown> | undefined,
  local: Record<string, unknown> | undefined,
  preferLocal: boolean,
  traceContext?: ConflictResolutionTraceContext,
  pathPrefix = ''
): Record<string, unknown> | undefined => {
  if (!remote && !local) return undefined;
  if (!remote) return local;
  if (!local) return remote;

  const result: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(remote), ...Object.keys(local)]);
  traceContext?.add({
    path: pathPrefix || '*',
    strategy: 'merge_object',
    winner: 'merged',
    reason: 'merge_object_fields',
  });

  keys.forEach(key => {
    const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    result[key] = mergeUnknown(remote[key], local[key], preferLocal, childPath, traceContext);
  });

  return result;
};

const mergeArrayById = <T>(
  remote: T[] = [],
  local: T[] = [],
  traceContext?: ConflictResolutionTraceContext,
  path = ''
): T[] => {
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

  traceContext?.add({
    path,
    strategy: 'merge_array_by_id',
    winner: 'merged',
    reason: 'union_preserve_local_override',
  });

  return sequence.map(id => output.get(id) as T);
};

const mergeUniquePrimitiveArray = (
  remote: string[] = [],
  local: string[] = [],
  preferLocal: boolean,
  traceContext?: ConflictResolutionTraceContext,
  path = ''
): string[] => {
  const preferred = preferLocal ? local : remote;
  const secondary = preferLocal ? remote : local;
  traceContext?.add({
    path,
    strategy: 'merge_unique_primitive_array',
    winner: 'merged',
    reason: preferLocal ? 'union_prefer_local_order' : 'union_prefer_remote_order',
  });
  return Array.from(new Set([...(preferred || []), ...(secondary || [])]));
};

const resolveItemId = (item: unknown): string => {
  if (item && typeof item === 'object' && 'id' in item) {
    return String((item as { id?: string | number }).id ?? JSON.stringify(item));
  }
  return JSON.stringify(item);
};
