import { describe, expect, it } from 'vitest';
import {
  buildTransferFormSubmission,
  resolveTransferFormState,
} from '@/features/transfers/components/controllers/transferFormController';
import type { TransferRequest } from '@/types/transfers';

describe('transferFormController', () => {
  it('maps unknown catalog values to Otro/Otra fields when editing a transfer', () => {
    const transfer = {
      id: 'tr-1',
      patientId: 'BED_A1',
      bedId: 'BED_A1',
      patientSnapshot: {
        name: 'Paciente Demo',
        rut: '1-9',
        age: 50,
        sex: 'F',
        diagnosis: 'Dx demo',
        admissionDate: '2026-03-01',
      },
      destinationHospital: 'Hospital no catalogado',
      transferReason: 'Derivación',
      requestingDoctor: '',
      requiredSpecialty: 'Subespecialidad rara',
      requiredBedType: 'Cama ECMO',
      observations: '',
      customFields: {},
      status: 'REQUESTED',
      statusHistory: [],
      requestDate: '2026-03-20',
      createdAt: '2026-03-20T12:00:00.000Z',
      updatedAt: '2026-03-20T12:00:00.000Z',
      createdBy: 'test@example.com',
    } satisfies TransferRequest;

    const state = resolveTransferFormState({
      transfer,
      destinationHospitals: [{ id: 'otro', name: 'Otro', city: '' }],
      defaultRequestDate: '2026-03-26',
    });

    expect(state).toMatchObject({
      selectedPatientId: 'BED_A1',
      destinationHospital: 'Otro',
      destinationHospitalOther: 'Hospital no catalogado',
      requiredSpecialty: 'Otra',
      requiredSpecialtyOther: 'Subespecialidad rara',
      requiredBedType: 'Otra',
      requiredBedTypeOther: 'Cama ECMO',
      requestDate: '2026-03-20',
    });
  });

  it('builds a normalized submission payload when custom destination and specialty are valid', () => {
    const result = buildTransferFormSubmission({
      selectedPatientId: 'BED_H5C1',
      requestDate: '2026-03-26',
      destinationHospital: 'Otro',
      destinationHospitalOther: 'Hospital Clínico X',
      requiredSpecialty: 'Otra',
      requiredSpecialtyOther: 'Cardiología pediátrica',
      requiredBedType: 'Cama UCI',
      requiredBedTypeOther: '',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        patientId: 'BED_H5C1',
        bedId: 'BED_H5C1',
        requestDate: '2026-03-26',
        destinationHospital: 'Hospital Clínico X',
        transferReason: 'Derivación a especialidad',
        requiredSpecialty: 'Cardiología pediátrica',
        requiredBedType: 'Cama UCI',
        requestingDoctor: '',
        observations: '',
      },
    });
  });

  it('rejects incomplete custom fields with a deterministic error message', () => {
    const result = buildTransferFormSubmission({
      selectedPatientId: 'BED_H5C1',
      requestDate: '2026-03-26',
      destinationHospital: 'Otro',
      destinationHospitalOther: '',
      requiredSpecialty: '',
      requiredSpecialtyOther: '',
      requiredBedType: '',
      requiredBedTypeOther: '',
    });

    expect(result).toEqual({
      ok: false,
      error: 'Por favor complete todos los campos requeridos',
    });
  });
});
