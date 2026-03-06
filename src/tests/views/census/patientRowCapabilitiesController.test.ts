import { describe, expect, it } from 'vitest';
import { resolvePatientRowCapabilities } from '@/features/census/controllers/patientRowCapabilitiesController';

describe('patientRowCapabilitiesController', () => {
  it('allows clinical document access only for clinical roles', () => {
    expect(
      resolvePatientRowCapabilities({
        role: 'doctor_urgency',
        patient: { patientName: 'Paciente', rut: '1-9' },
        isBlocked: false,
        isEmpty: false,
      })
    ).toMatchObject({
      canOpenClinicalDocuments: true,
      canShowClinicalDocumentIndicator: true,
      canOpenExamRequest: true,
      canOpenImagingRequest: true,
      canOpenHistory: true,
    });

    expect(
      resolvePatientRowCapabilities({
        role: 'viewer_census',
        patient: { patientName: 'Paciente', rut: '1-9' },
        isBlocked: false,
        isEmpty: false,
      })
    ).toMatchObject({
      canOpenClinicalDocuments: false,
      canShowClinicalDocumentIndicator: false,
      canOpenExamRequest: true,
      canOpenImagingRequest: true,
      canOpenHistory: true,
    });
  });

  it('suppresses clinical document capabilities for blocked or empty rows', () => {
    expect(
      resolvePatientRowCapabilities({
        role: 'admin',
        patient: { patientName: 'Paciente', rut: '1-9' },
        isBlocked: true,
        isEmpty: false,
      }).canOpenClinicalDocuments
    ).toBe(false);

    expect(
      resolvePatientRowCapabilities({
        role: 'admin',
        patient: { patientName: '', rut: '' },
        isBlocked: false,
        isEmpty: true,
      })
    ).toMatchObject({
      canOpenClinicalDocuments: false,
      canShowClinicalDocumentIndicator: false,
      canOpenExamRequest: false,
      canOpenImagingRequest: false,
      canOpenHistory: false,
    });
  });
});
