import { logger } from '@/services/utils/loggerService';

export type ScopedLogger = ReturnType<typeof logger.child>;

export const createScopedLogger = (context: string): ScopedLogger => logger.child(context);
