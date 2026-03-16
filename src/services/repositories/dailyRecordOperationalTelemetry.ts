import { createDomainObservability } from '@/services/observability/domainObservability';

export const dailyRecordObservability = createDomainObservability(
  'daily_record',
  'DailyRecordDomain'
);
