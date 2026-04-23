import { logger } from '@/services/utils/loggerService';

export type ScopedLogger = ReturnType<typeof logger.child>;

export const createScopedLogger = (context: string): ScopedLogger => logger.child(context);

export const createScopedLoggerMap = <TScopes extends Record<string, string>>(
  scopes: TScopes
): { [K in keyof TScopes]: ScopedLogger } =>
  Object.fromEntries(
    Object.entries(scopes).map(([key, context]) => [key, createScopedLogger(context)])
  ) as { [K in keyof TScopes]: ScopedLogger };
