import { describe, expect, it } from 'vitest';
import {
  buildHandoffNovedadesAuditPayload,
  buildMedicalNoChangesAuditPayload,
  buildMedicalSignatureAuditPayload,
  buildMedicalSpecialtyNoteAuditPayload,
  buildResetMedicalHandoffAuditPayload,
  buildUpdatedHandoffStaffRecord,
} from '@/hooks/controllers/handoffManagementPersistenceController';
import type { DailyRecord } from '@/types';

const baseRecord = (): DailyRecord =>
  ({
    date: '2026-03-07',
    handoffNovedadesDayShift: 'Antes día',
    handoffNovedadesNightShift: 'Antes noche',
    medicalHandoffNovedades: 'Antes medica',
    medicalHandoffBySpecialty: {
      cirugia: {
        note: 'Nota previa',
        version: 2,
        updatedAt: '2026-03-06T10:00:00.000Z',
        author: {
          uid: 'doctor-1',
          displayName: 'Dr. Cirugía',
          email: 'cirugia@hospital.cl',
        },
      },
    },
    nursesDayShift: ['Dia 1'],
    nursesNightShift: ['Noche 1'],
    tensDayShift: ['Tens Día'],
    tensNightShift: ['Tens Noche'],
    handoffNightReceives: ['Recibe Noche'],
    medicalHandoffDoctor: 'Dr. Test',
    medicalSignature: 'Dr. Legacy',
    medicalSignatureByScope: {
      all: { doctorName: 'Dr. Test', signedAt: '2026-03-07T09:00:00.000Z' },
    },
    medicalHandoffSentAt: '2026-03-07T09:05:00.000Z',
    medicalHandoffSentAtByScope: { all: '2026-03-07T09:05:00.000Z' },
  }) as unknown as DailyRecord;

describe('handoffManagementPersistenceController', () => {
  it('builds novedades payloads using the previous content', () => {
    const payload = buildHandoffNovedadesAuditPayload(baseRecord(), 'day', 'Texto nuevo', 'u1');

    expect(payload.details).toEqual(
      expect.objectContaining({
        shift: 'day',
        value: 'Texto nuevo',
        changes: {
          novedades: { old: 'Antes día', new: 'Texto nuevo' },
        },
      })
    );
  });

  it('builds specialty note payloads from the current record', () => {
    expect(buildMedicalSpecialtyNoteAuditPayload(baseRecord(), 'cirugia', 'Nueva nota')).toEqual(
      expect.objectContaining({
        specialty: 'cirugia',
        operation: 'specialty_note_update',
        changes: {
          novedades: { old: 'Nota previa', new: 'Nueva nota' },
        },
      })
    );
  });

  it('updates staff using canonical shift fields', () => {
    const updated = buildUpdatedHandoffStaffRecord(baseRecord(), 'night', 'receives', [
      'Recibe A',
      'Recibe B',
    ]);

    expect(updated.handoffNightReceives).toEqual(['Recibe A', 'Recibe B']);
    expect(updated.lastUpdated).toBeTypeOf('string');
  });

  it('builds no changes, signature and reset payloads consistently', () => {
    const updatedRecord = {
      ...baseRecord(),
      medicalHandoffBySpecialty: {
        cirugia: {
          ...baseRecord().medicalHandoffBySpecialty!.cirugia,
          dailyContinuity: {
            '2026-03-07': { status: 'confirmed_no_changes', comment: 'Sin cambios' },
          },
        },
      },
    } as DailyRecord;

    expect(
      buildMedicalNoChangesAuditPayload(
        updatedRecord,
        'cirugia',
        { displayName: 'Admin', specialty: 'cirugia' },
        '2026-03-07',
        '2026-03-07T10:00:00.000Z'
      )
    ).toEqual(
      expect.objectContaining({
        operation: 'confirm_no_changes',
        comment: 'Sin cambios',
      })
    );

    expect(buildMedicalSignatureAuditPayload(updatedRecord, 'Dr. Test', 'all')).toEqual({
      doctorName: 'Dr. Test',
      signedAt: '2026-03-07T09:00:00.000Z',
      scope: 'all',
    });

    expect(buildResetMedicalHandoffAuditPayload(baseRecord())).toEqual(
      expect.objectContaining({
        clearedFields: ['entrega', 'firma'],
        hadMedicalHandoffSentAt: true,
        hadMedicalSignature: true,
      })
    );
  });
});
