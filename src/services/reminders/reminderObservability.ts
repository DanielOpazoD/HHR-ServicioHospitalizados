import { createDomainObservability } from '@/services/observability/domainObservability';

export const reminderObservability = createDomainObservability('reminders', 'ReminderDomain');
