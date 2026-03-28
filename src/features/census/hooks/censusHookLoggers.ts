import { createScopedLogger } from '@/services/utils/loggerScope';

export const clinicalDocumentPresenceLogger = createScopedLogger(
  'useClinicalDocumentPresenceByBed'
);
export const censusMigrationLogger = createScopedLogger('useCensusMigrationBootstrap');
