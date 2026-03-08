import { logSystemError } from '@/services/admin/auditService';
import { dispatchOperationalTelemetryExternally } from '@/services/observability/operationalTelemetryExternalAdapter';
import { saveErrorLog } from '@/services/storage/indexeddb/indexedDbErrorLogService';
import type { ErrorLog } from '@/services/logging/errorLogTypes';

export type ErrorServiceSink = (errorLog: ErrorLog) => Promise<void> | void;

export interface ErrorServiceSinkOptions {
  allowDevConsole?: boolean;
}

export const createDevConsoleErrorSink =
  (enabled: boolean): ErrorServiceSink =>
  errorLog => {
    if (!enabled) return;
    console.error('[ErrorService]', errorLog);
  };

export const indexedDbErrorSink: ErrorServiceSink = async errorLog => {
  await saveErrorLog(errorLog);
};

export const auditErrorSink: ErrorServiceSink = async errorLog => {
  if (errorLog.severity !== 'high' && errorLog.severity !== 'critical') {
    return;
  }

  await logSystemError(errorLog.message, errorLog.severity, {
    stack: errorLog.stack,
    context: errorLog.context,
    url: errorLog.url,
    userAgent: errorLog.userAgent,
    originalErrorId: errorLog.id,
  });
};

const mapSeverityToTelemetryStatus = (severity: ErrorLog['severity']): 'degraded' | 'failed' =>
  severity === 'critical' || severity === 'high' ? 'failed' : 'degraded';

export const externalTelemetryErrorSink: ErrorServiceSink = async errorLog => {
  await dispatchOperationalTelemetryExternally({
    category: 'sync',
    status: mapSeverityToTelemetryStatus(errorLog.severity),
    operation: 'error_service_log',
    timestamp: errorLog.timestamp,
    issues: [errorLog.message],
    context: {
      errorId: errorLog.id,
      severity: errorLog.severity,
      url: errorLog.url,
    },
  });
};

export const buildDefaultErrorServiceSinks = (
  options: ErrorServiceSinkOptions = {}
): ErrorServiceSink[] => [
  createDevConsoleErrorSink(Boolean(options.allowDevConsole)),
  async errorLog => {
    try {
      await indexedDbErrorSink(errorLog);
    } catch (error) {
      console.error('[ErrorServiceSink] Failed to persist in IndexedDB:', error);
    }
  },
  async errorLog => {
    try {
      await auditErrorSink(errorLog);
    } catch (error) {
      console.error('[ErrorServiceSink] Failed to persist in audit log:', error);
    }
  },
  async errorLog => {
    try {
      await externalTelemetryErrorSink(errorLog);
    } catch (error) {
      console.error('[ErrorServiceSink] Failed to dispatch external telemetry:', error);
    }
  },
];

export const runErrorServiceSinks = async (
  errorLog: ErrorLog,
  sinks: ErrorServiceSink[]
): Promise<void> => {
  for (const sink of sinks) {
    await sink(errorLog);
  }
};
