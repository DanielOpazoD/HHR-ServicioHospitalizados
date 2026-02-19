export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ErrorLog {
  id: string;
  timestamp: string;
  message: string;
  severity: ErrorSeverity;
  stack?: string;
  userId?: string;
  userEmail?: string;
  context?: Record<string, unknown>;
  userAgent?: string;
  url?: string;
}
