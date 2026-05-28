import { describe, expect, it } from 'vitest';

import { generateAuditWorkbook } from '@/services/exporters/auditWorkbook';
import type { AuditLogEntry } from '@/types/auditLogTypes';

const log: AuditLogEntry = {
  id: 'xlsx-audit-1',
  timestamp: '2026-05-28T10:15:30.000Z',
  userId: 'dra.riviere@hospital.cl',
  userDisplayName: 'Dra. Riviere',
  userUid: 'uid-123',
  ipAddress: '190.10.10.10',
  action: 'PATIENT_MODIFIED',
  entityType: 'patient',
  entityId: 'Cama 6',
  patientIdentifier: '12.345.678-9',
  summary: 'Movimiento técnico',
  details: {
    movementKind: 'move',
    patientName: 'Juan Perez',
    sourceBed: '4',
    targetBed: '6',
  },
};

describe('auditWorkbook', () => {
  it('exports clinical legal columns instead of raw details', async () => {
    const workbook = await generateAuditWorkbook([log]);
    const sheet = workbook.getWorksheet('Auditoría Clínica Legal');

    expect(sheet).toBeDefined();
    expect(sheet?.getRow(1).values).toEqual(
      expect.arrayContaining(['EVENTO CLÍNICO', 'RELATO CLÍNICO', 'AFECTADO', 'ORIGEN/IP'])
    );

    const exportedValues = JSON.stringify(sheet?.getRow(2).values);
    expect(exportedValues).toContain('Paciente trasladado de cama');
    expect(exportedValues).toContain('Juan Perez fue trasladado desde cama 4 a cama 6');
    expect(exportedValues).toContain('IP 190.10.10.10');
    expect(exportedValues).not.toContain('PATIENT_MODIFIED');
    expect(exportedValues).not.toContain('movementKind');
    expect(exportedValues).not.toContain('Movimiento técnico');
  });
});
