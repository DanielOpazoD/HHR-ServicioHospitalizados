import { describe, expect, it } from 'vitest';

import {
  EMPTY_TRANSFER_DOCUMENT_PACKAGE_MESSAGE,
  MISSING_TRANSFER_FORMS_MESSAGE,
  TRANSFER_DOCUMENT_PACKAGE_ERROR_MESSAGE,
  resolveTransferDestinationHospitalId,
  resolveTransferDocumentPackageMessage,
  withSelectedTransfer,
} from '@/hooks/controllers/transferViewStatesController';
import type { TransferRequest } from '@/types/transfers';

describe('transferViewStatesController', () => {
  it('resolves configured destination hospital ids and missing destinations', () => {
    expect(resolveTransferDestinationHospitalId('Hospital del Salvador')).toBe('hospital-salvador');
    expect(resolveTransferDestinationHospitalId('Hospital inexistente')).toBeNull();
  });

  it('maps transfer document package outcomes to user-facing messages', () => {
    expect(resolveTransferDocumentPackageMessage({ kind: 'empty' })).toBe(
      EMPTY_TRANSFER_DOCUMENT_PACKAGE_MESSAGE
    );
    expect(resolveTransferDocumentPackageMessage({ kind: 'error', error: new Error('boom') })).toBe(
      TRANSFER_DOCUMENT_PACKAGE_ERROR_MESSAGE
    );
    expect(
      resolveTransferDocumentPackageMessage({
        kind: 'success',
        signature: 'sig',
        documents: [],
        patientData: {
          patientName: 'Paciente',
          rut: '1-9',
          bedName: 'R1',
          bedType: 'Básica',
          isUPC: false,
          originHospital: 'Hospital Hanga Roa',
        },
      })
    ).toBeNull();
  });

  it('runs selected-transfer mutations only when a transfer exists', async () => {
    const transfer = { id: 'TR-1' } as TransferRequest;
    const seen: string[] = [];

    await withSelectedTransfer(null, async current => {
      seen.push(current.id);
    });
    await withSelectedTransfer(transfer, async current => {
      seen.push(current.id);
    });

    expect(seen).toEqual(['TR-1']);
    expect(MISSING_TRANSFER_FORMS_MESSAGE).toContain('formularios de traslado');
  });
});
