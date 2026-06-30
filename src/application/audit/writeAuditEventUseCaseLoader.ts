export type WriteAuditEvent =
  typeof import('@/application/audit/writeAuditEventUseCase').executeWriteAuditEvent;

export const loadWriteAuditEventUseCase = () =>
  import('@/application/audit/writeAuditEventUseCase');

export const loadExecuteWriteAuditEvent = async (): Promise<WriteAuditEvent> => {
  const { executeWriteAuditEvent } = await loadWriteAuditEventUseCase();
  return executeWriteAuditEvent;
};
