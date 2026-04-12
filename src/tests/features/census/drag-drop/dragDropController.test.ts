/**
 * Tests for the drag & drop controller (pure logic).
 */

import { describe, it, expect } from 'vitest';
import {
  buildPendingBedMove,
  formatBedMoveConfirmationMessage,
  DRAG_DATA_FORMAT,
} from '@/features/census/drag-drop/dragDropController';

describe('dragDropController', () => {
  describe('DRAG_DATA_FORMAT', () => {
    it('uses a namespaced MIME type', () => {
      expect(DRAG_DATA_FORMAT).toBe('text/x-bed-id');
    });
  });

  describe('buildPendingBedMove', () => {
    const beds: Record<string, { patientName?: string }> = {
      R1: { patientName: 'Juan Perez' },
      R2: { patientName: 'Maria Lopez' },
      R3: { patientName: '' },
      NEO1: {},
    };

    it('returns a valid PendingBedMove with patient name', () => {
      const result = buildPendingBedMove('R1', 'E1', beds);

      expect(result).toEqual({
        sourceBedId: 'R1',
        targetBedId: 'E1',
        patientName: 'Juan Perez',
      });
    });

    it('defaults patient name to "Paciente" when empty', () => {
      const result = buildPendingBedMove('R3', 'E1', beds);

      expect(result).not.toBeNull();
      expect(result!.patientName).toBe('Paciente');
    });

    it('defaults patient name to "Paciente" when undefined', () => {
      const result = buildPendingBedMove('NEO1', 'E1', beds);

      expect(result).not.toBeNull();
      expect(result!.patientName).toBe('Paciente');
    });

    it('defaults patient name when bed not in record', () => {
      const result = buildPendingBedMove('H1C1', 'E1', beds);

      expect(result).not.toBeNull();
      expect(result!.patientName).toBe('Paciente');
    });

    it('returns null when source and target are the same', () => {
      expect(buildPendingBedMove('R1', 'R1', beds)).toBeNull();
    });

    it('returns null when source is empty string', () => {
      expect(buildPendingBedMove('', 'E1', beds)).toBeNull();
    });

    it('returns null when target is empty string', () => {
      expect(buildPendingBedMove('R1', '', beds)).toBeNull();
    });
  });

  describe('formatBedMoveConfirmationMessage', () => {
    it('formats a human-readable confirmation message', () => {
      const message = formatBedMoveConfirmationMessage({
        sourceBedId: 'R1',
        targetBedId: 'E3',
        patientName: 'Juan Perez',
      });

      expect(message).toBe('Mover a Juan Perez de cama R1 a cama E3');
    });
  });
});
