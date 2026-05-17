import { beforeEach, describe, expect, it } from 'vitest';
import type { DailyRecordPatch } from '@/application/shared/dailyRecordCoreContracts';
import {
  acknowledgeDailyRecordClinicalFieldPause,
  clearDailyRecordClinicalFieldPausesForTests,
  DAILY_RECORD_CONTEXT_RESET_MESSAGE,
  DAILY_RECORD_FIELD_PAUSE_MESSAGE,
  registerDailyRecordClinicalFieldPauses,
  resolveDailyRecordClinicalPatchPauseDecision,
} from '@/hooks/controllers/dailyRecordClinicalFieldAcknowledgementController';

describe('dailyRecordClinicalFieldAcknowledgementController', () => {
  const date = '2026-05-17';

  beforeEach(() => {
    clearDailyRecordClinicalFieldPausesForTests();
  });

  it('pauses the first same-group edit and allows it after acknowledgement', () => {
    registerDailyRecordClinicalFieldPauses(date, { R1: { diagnosis: true } }, 1_000);

    const diagnosisPatch = { 'beds.R1.cie10Code': 'I10' } satisfies DailyRecordPatch;

    expect(resolveDailyRecordClinicalPatchPauseDecision(date, diagnosisPatch, 1_100)).toEqual({
      kind: 'soft_pause',
      bedId: 'R1',
      fieldGroup: 'diagnosis',
      message: 'Actualizado recién. Intente nuevamente para editar.',
    });

    expect(acknowledgeDailyRecordClinicalFieldPause(date, 'R1', 'diagnosis')).toBe('acknowledged');
    expect(resolveDailyRecordClinicalPatchPauseDecision(date, diagnosisPatch, 1_200)).toEqual({
      kind: 'allowed',
    });
  });

  it('allows independent clinical fields without acknowledgement', () => {
    registerDailyRecordClinicalFieldPauses(date, { R1: { diagnosis: true } }, 1_000);

    expect(
      resolveDailyRecordClinicalPatchPauseDecision(date, { 'beds.R1.status': 'Estable' }, 1_100)
    ).toEqual({ kind: 'allowed' });
  });

  it('keeps episode-level locks hard even after repeated attempts', () => {
    registerDailyRecordClinicalFieldPauses(
      date,
      { R1: { allClinical: true, diagnosis: true } },
      1_000
    );

    expect(
      resolveDailyRecordClinicalPatchPauseDecision(date, { 'beds.R1.pathology': 'Usuario' }, 1_100)
    ).toEqual({
      kind: 'hard_lock',
      bedId: 'R1',
      message:
        'Esta cama se actualizó hace un momento. Seleccione nuevamente el paciente para continuar.',
    });
    expect(acknowledgeDailyRecordClinicalFieldPause(date, 'R1', 'diagnosis')).toBe('hard_locked');
  });

  it('keeps user-facing pause and lock copy free of technical sync wording', () => {
    const forbiddenTechnicalWording = [/firebase/i, /remot[oa]/i, /stale/i, /cache/i, /concurr/i];

    for (const message of [DAILY_RECORD_FIELD_PAUSE_MESSAGE, DAILY_RECORD_CONTEXT_RESET_MESSAGE]) {
      for (const pattern of forbiddenTechnicalWording) {
        expect(message).not.toMatch(pattern);
      }
    }
  });
});
