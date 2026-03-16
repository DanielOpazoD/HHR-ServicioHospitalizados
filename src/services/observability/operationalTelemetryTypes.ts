export type OperationalTelemetryCategory =
  | 'auth'
  | 'daily_record'
  | 'firestore'
  | 'sync'
  | 'indexeddb'
  | 'integration'
  | 'export'
  | 'backup'
  | 'reminders'
  | 'transfers'
  | 'clinical_document'
  | 'create_day'
  | 'handoff';

export type OperationalTelemetryStatus = 'success' | 'partial' | 'degraded' | 'failed';

export interface OperationalTelemetryEvent {
  category: OperationalTelemetryCategory;
  status: OperationalTelemetryStatus;
  operation: string;
  timestamp: string;
  date?: string;
  issues?: string[];
  context?: Record<string, unknown>;
}
