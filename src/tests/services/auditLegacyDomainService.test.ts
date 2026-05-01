import { describe, expect, it, vi } from 'vitest';

vi.unmock('@/services/admin/auditLegacyDomainService');

describe('auditLegacyDomainService migration surface', () => {
  it('does not expose daily record lifecycle helpers after migration to AuditContext', async () => {
    const legacyDomainService = await import('@/services/admin/auditLegacyDomainService');

    expect(legacyDomainService).not.toHaveProperty('logDailyRecordCreated');
    expect(legacyDomainService).not.toHaveProperty('logDailyRecordDeleted');
    expect(legacyDomainService).not.toHaveProperty('logCudyrModified');
    expect(legacyDomainService).not.toHaveProperty('logHandoffNovedadesModified');
    expect(legacyDomainService).not.toHaveProperty('logMedicalHandoffModified');
    expect(legacyDomainService).not.toHaveProperty('logNurseHandoffModified');
  });
});
