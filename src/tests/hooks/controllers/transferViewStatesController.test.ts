import { describe, expect, it } from 'vitest';

import {
  EMPTY_TRANSFER_DOCUMENT_PACKAGE_MESSAGE,
  MISSING_TRANSFER_FORMS_MESSAGE,
  TRANSFER_DOCUMENT_PACKAGE_ERROR_MESSAGE,
  resolveTransferDocumentPackageApplyPlan,
  resolveTransferDestinationHospitalId,
  resolveTransferDocumentPackageMessage,
  resolveTransferDocumentWorkflowPlan,
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

  it('builds document workflow plans for prepare and view flows', () => {
    const configuredTransfer = {
      destinationHospital: 'Hospital del Salvador',
      questionnaireResponses: {
        acompanante: 'Sí',
      },
    } as unknown as TransferRequest;

    expect(
      resolveTransferDocumentWorkflowPlan({
        transfer: { destinationHospital: 'Hospital inexistente' } as TransferRequest,
        mode: 'prepare',
      })
    ).toEqual({
      kind: 'blocked',
      message: MISSING_TRANSFER_FORMS_MESSAGE,
    });

    expect(
      resolveTransferDocumentWorkflowPlan({
        transfer: configuredTransfer,
        mode: 'prepare',
      })
    ).toEqual({
      kind: 'open-questionnaire',
      hospitalId: 'hospital-salvador',
    });

    expect(
      resolveTransferDocumentWorkflowPlan({
        transfer: { destinationHospital: 'Hospital del Salvador' } as TransferRequest,
        mode: 'view',
      })
    ).toEqual({
      kind: 'noop',
    });

    expect(
      resolveTransferDocumentWorkflowPlan({
        transfer: configuredTransfer,
        mode: 'view',
      })
    ).toEqual({
      kind: 'open-package',
      hospitalId: 'hospital-salvador',
      responses: configuredTransfer.questionnaireResponses,
    });
  });

  it('builds document package apply plans for package outcomes', () => {
    expect(resolveTransferDocumentPackageApplyPlan({ kind: 'empty' })).toEqual({
      kind: 'message',
      message: EMPTY_TRANSFER_DOCUMENT_PACKAGE_MESSAGE,
      shouldLogError: false,
    });

    expect(
      resolveTransferDocumentPackageApplyPlan({ kind: 'error', error: new Error('boom') })
    ).toEqual({
      kind: 'message',
      message: TRANSFER_DOCUMENT_PACKAGE_ERROR_MESSAGE,
      shouldLogError: true,
    });

    expect(
      resolveTransferDocumentPackageApplyPlan({
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
    ).toEqual({
      kind: 'open-package',
      documents: [],
      patientData: {
        patientName: 'Paciente',
        rut: '1-9',
        bedName: 'R1',
        bedType: 'Básica',
        isUPC: false,
        originHospital: 'Hospital Hanga Roa',
      },
    });
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
