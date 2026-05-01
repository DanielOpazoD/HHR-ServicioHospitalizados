import { describe, expect, it } from 'vitest';
import { parseLabPatientBirthDateFromPdfText } from '@/features/laboratory/services/labPatientPdfMetadataService';

describe('labPatientPdfMetadataService', () => {
  it('extracts and normalizes patient birth date from Syslab PDF metadata text', () => {
    expect(
      parseLabPatientBirthDateFromPdfText(`
        HOSPITAL DE HANGA ROA
        Nombre : PACIENTE EXTERNO
        Rut/Fic: 11.111.111-1
        Fecha de Nacimiento: 12/04/1980
      `)
    ).toBe('1980-04-12');
  });

  it('supports abbreviated Syslab birth date labels', () => {
    expect(parseLabPatientBirthDateFromPdfText('F. Nac.: 03-11-1975')).toBe('1975-11-03');
  });
});
