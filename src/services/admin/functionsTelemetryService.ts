/**
 * Functions Telemetry Service
 * Reads telemetry entries written by netlify/functions/lib/observability.ts.
 * Collection is append-only (Firestore rules enforce deny update/delete).
 */

import { firestoreDb } from '@/services/storage/firestore';
import { getActiveHospitalId } from '@/constants/firestorePaths';
import type {
  FunctionsTelemetryEntry,
  FunctionsTelemetryServiceSummary,
} from '@/types/functionsTelemetry';

const COLLECTION_PATH = () => `hospitals/${getActiveHospitalId()}/functionsTelemetry`;

const DEFAULT_LIMIT = 500;

interface RawTelemetryRecord {
  id?: string;
  service?: string;
  operation?: string;
  hospitalId?: string;
  durationMs?: number;
  attempt?: number;
  totalAttempts?: number;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  context?: Record<string, unknown>;
  timestamp?: string;
}

const normalizeEntry = (raw: RawTelemetryRecord & { id: string }): FunctionsTelemetryEntry => ({
  id: raw.id,
  service: raw.service ?? 'unknown',
  operation: raw.operation ?? 'unknown',
  hospitalId: raw.hospitalId,
  durationMs: typeof raw.durationMs === 'number' ? raw.durationMs : 0,
  attempt: typeof raw.attempt === 'number' ? raw.attempt : 1,
  totalAttempts: typeof raw.totalAttempts === 'number' ? raw.totalAttempts : 1,
  status:
    raw.status === 'success' || raw.status === 'failure' || raw.status === 'timeout'
      ? raw.status
      : 'failure',
  errorCode: raw.errorCode,
  errorMessage: raw.errorMessage,
  context: raw.context as FunctionsTelemetryEntry['context'],
  timestamp: raw.timestamp ?? new Date().toISOString(),
});

export const fetchFunctionsTelemetry = async (
  limitCount: number = DEFAULT_LIMIT
): Promise<FunctionsTelemetryEntry[]> => {
  const rows = await firestoreDb.getDocs<RawTelemetryRecord & { id: string }>(COLLECTION_PATH(), {
    orderBy: [{ field: 'timestamp', direction: 'desc' }],
    limit: limitCount,
  });
  return rows.map(normalizeEntry);
};

export const buildServiceSummaries = (
  entries: FunctionsTelemetryEntry[]
): FunctionsTelemetryServiceSummary[] => {
  const groups = new Map<string, FunctionsTelemetryEntry[]>();
  for (const entry of entries) {
    const bucket = groups.get(entry.service) || [];
    bucket.push(entry);
    groups.set(entry.service, bucket);
  }

  const summaries: FunctionsTelemetryServiceSummary[] = [];
  for (const [service, bucket] of groups.entries()) {
    const total = bucket.length;
    const successes = bucket.filter(e => e.status === 'success').length;
    const failures = bucket.filter(e => e.status === 'failure').length;
    const timeouts = bucket.filter(e => e.status === 'timeout').length;
    const errorRate = total > 0 ? (failures + timeouts) / total : 0;
    const avgDurationMs =
      total > 0 ? Math.round(bucket.reduce((sum, e) => sum + e.durationMs, 0) / total) : 0;
    const lastEntryAt = bucket
      .map(e => e.timestamp)
      .sort()
      .slice(-1)[0];

    summaries.push({
      service,
      total,
      successes,
      failures,
      timeouts,
      errorRate,
      avgDurationMs,
      lastEntryAt,
    });
  }

  return summaries.sort((a, b) => b.errorRate - a.errorRate || b.total - a.total);
};
