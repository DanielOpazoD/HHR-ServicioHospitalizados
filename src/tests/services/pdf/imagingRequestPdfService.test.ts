import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  SOLICITUD_FIELD_COORDS,
  ENCUESTA_FIELD_COORDS,
} from '@/services/pdf/imagingRequestPdfService';
import {
  formatDateToCL as formatDate,
  calculateAge,
  splitPatientName,
} from '@/utils/clinicalUtils';

// We mock standard functions to just test data transforms and constants
describe('imagingRequestPdfService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-28T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Name Splitter Logic', () => {
    it('should split standard names correctly (Nombre ApPaterno ApMaterno)', () => {
      const [nombres, apPaterno, apMaterno] = splitPatientName('Marcelo Valdes Avila');
      expect(nombres).toBe('Marcelo');
      expect(apPaterno).toBe('Valdes');
      expect(apMaterno).toBe('Avila');
    });

    it('should handle composite first names correctly', () => {
      const [nombres, apPaterno, apMaterno] = splitPatientName('Juan Carlos De La Fuente Perez');
      expect(nombres).toBe('Juan Carlos De La');
      expect(apPaterno).toBe('Fuente');
      expect(apMaterno).toBe('Perez');
    });

    it('should handle single names', () => {
      const [nombres, apPaterno, apMaterno] = splitPatientName('Marcelo');
      expect(nombres).toBe('Marcelo');
      expect(apPaterno).toBe('');
      expect(apMaterno).toBe('');
    });

    it('should handle two words (Nombre Apellido)', () => {
      const [nombres, apPaterno, apMaterno] = splitPatientName('Marcelo Valdes');
      expect(nombres).toBe('Marcelo');
      expect(apPaterno).toBe('Valdes');
      expect(apMaterno).toBe('');
    });
  });

  describe('Data formatters', () => {
    it('should format dates correctly', () => {
      expect(formatDate('2026-02-15')).toBe('15-02-2026');
      expect(formatDate('15-02-2026')).toBe('15-02-2026');
      expect(formatDate(undefined)).toBe('');
    });

    it('should calculate age correctly', () => {
      expect(calculateAge('1996-01-01')).toBe('30 años');
    });
  });

  describe('Coordinate Constants', () => {
    it('should have mapped coordinates for Solicitud', () => {
      expect(SOLICITUD_FIELD_COORDS).toBeDefined();
      expect(SOLICITUD_FIELD_COORDS.nombres.x).toBeGreaterThan(0);
      expect(SOLICITUD_FIELD_COORDS.rut.maxWidth).toBeGreaterThan(0);
    });

    it('should have mapped coordinates for Encuesta', () => {
      expect(ENCUESTA_FIELD_COORDS).toBeDefined();
      expect(ENCUESTA_FIELD_COORDS.nombres.x).toBeGreaterThan(0);
      expect(ENCUESTA_FIELD_COORDS.rut.maxWidth).toBeGreaterThan(0);
    });
  });
});
