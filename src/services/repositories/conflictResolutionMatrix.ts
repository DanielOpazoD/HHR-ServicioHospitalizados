import { DailyRecord, DailyRecordPatch } from '@/types/domain/dailyRecord';
import { applyPatches } from '@/utils/patchUtils';
import {
  CONFLICT_RESOLUTION_POLICY_VERSION,
  RECORD_STRUCTURAL_FIELDS,
  decideScalarByPolicy,
} from '@/services/repositories/conflictResolutionPolicy';
import {
  getValueAtPath,
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
import {
  ID_BASED_ARRAY_FIELDS,
  UNIQUE_ARRAY_FIELDS,
  PATIENT_ID_ARRAY_FIELDS,
  PATIENT_UNIQUE_ARRAY_FIELDS,
  mergeBeds,
  mergeArrayById,
  mergeUniquePrimitiveArray,
  mergeObject,
  mergePatientData,
} from '@/services/repositories/conflictResolutionMergeUtils';
import {
  buildCompatibleDayShiftStaffingMirror,
  resolveDayShiftNurses,
} from '@/services/staff/dailyRecordStaffing';

interface ConflictResolutionOptions {
  changedPaths?: string[];
}

export interface ConflictResolutionResult {
  record: DailyRecord;
  trace: ConflictResolutionTrace;
}

const resolveCanonicalDayShiftNurses = (
  remote: DailyRecord,
  local: DailyRecord,
  preferLocal: boolean,
  traceContext?: ConflictResolutionTraceContext
): string[] =>
  mergeUniquePrimitiveArray(
    resolveDayShiftNurses(remote),
    resolveDayShiftNurses(local),
    preferLocal,
    traceContext,
    'nursesDayShift'
  );

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
  const resolvedNursesDayShift = resolveCanonicalDayShiftNurses(
    remote,
    local,
    preferLocal,
    traceContext
  );

  const resolved: DailyRecord = {
    ...secondary,
    ...preferred,
    date: remote.date || local.date,
    beds: mergeBeds(remote.beds, local.beds, preferLocal, traceContext, 'beds'),
    discharges: mergeArrayById(remote.discharges, local.discharges, traceContext, 'discharges'),
    transfers: mergeArrayById(remote.transfers, local.transfers, traceContext, 'transfers'),
    cma: mergeArrayById(remote.cma, local.cma, traceContext, 'cma'),
    // Keep legacy `nurses` only as a compatibility mirror of the canonical day shift array.
    nurses: [...resolvedNursesDayShift],
    nursesDayShift: resolvedNursesDayShift,
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
    medicalHandoffBySpecialty: mergeObject(
      remote.medicalHandoffBySpecialty as unknown as Record<string, unknown> | undefined,
      local.medicalHandoffBySpecialty as unknown as Record<string, unknown> | undefined,
      preferLocal,
      traceContext,
      'medicalHandoffBySpecialty'
    ) as DailyRecord['medicalHandoffBySpecialty'],
    medicalSignature: mergeObject(
      remote.medicalSignature as unknown as Record<string, unknown> | undefined,
      local.medicalSignature as unknown as Record<string, unknown> | undefined,
      preferLocal,
      traceContext,
      'medicalSignature'
    ) as DailyRecord['medicalSignature'],
    medicalSignatureByScope: mergeObject(
      remote.medicalSignatureByScope as unknown as Record<string, unknown> | undefined,
      local.medicalSignatureByScope as unknown as Record<string, unknown> | undefined,
      preferLocal,
      traceContext,
      'medicalSignatureByScope'
    ) as DailyRecord['medicalSignatureByScope'],
    medicalHandoffSentAtByScope: mergeObject(
      remote.medicalHandoffSentAtByScope as unknown as Record<string, unknown> | undefined,
      local.medicalHandoffSentAtByScope as unknown as Record<string, unknown> | undefined,
      preferLocal,
      traceContext,
      'medicalHandoffSentAtByScope'
    ) as DailyRecord['medicalHandoffSentAtByScope'],
    medicalSignatureLinkTokenByScope: mergeObject(
      remote.medicalSignatureLinkTokenByScope as unknown as Record<string, unknown> | undefined,
      local.medicalSignatureLinkTokenByScope as unknown as Record<string, unknown> | undefined,
      preferLocal,
      traceContext,
      'medicalSignatureLinkTokenByScope'
    ) as DailyRecord['medicalSignatureLinkTokenByScope'],
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

    if (root === 'nurses' || root === 'nursesDayShift') {
      const mergedDayShift = resolveCanonicalDayShiftNurses(remote, local, true, traceContext);
      Object.assign(
        patches as Record<string, unknown>,
        buildCompatibleDayShiftStaffingMirror(mergedDayShift)
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
