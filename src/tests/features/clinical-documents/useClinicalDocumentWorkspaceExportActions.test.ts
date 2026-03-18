import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

import { createClinicalDocumentDraft } from '@/features/clinical-documents/domain/factories';
import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import { useClinicalDocumentWorkspaceExportActions } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceExportActions';
import * as pdfExportUseCase from '@/application/clinical-documents/clinicalDocumentPdfExportUseCase';
import * as printOpenUseCase from '@/application/clinical-documents/clinicalDocumentPrintOpenUseCase';

vi.mock('@/application/clinical-documents/clinicalDocumentPdfExportUseCase', async () => {
  const actual = await vi.importActual<
    typeof import('@/application/clinical-documents/clinicalDocumentPdfExportUseCase')
  >('@/application/clinical-documents/clinicalDocumentPdfExportUseCase');
  return {
    ...actual,
    executeExportClinicalDocumentPdf: vi.fn(),
  };
});

vi.mock('@/application/clinical-documents/clinicalDocumentPrintOpenUseCase', async () => {
  const actual = await vi.importActual<
    typeof import('@/application/clinical-documents/clinicalDocumentPrintOpenUseCase')
  >('@/application/clinical-documents/clinicalDocumentPrintOpenUseCase');
  return {
    ...actual,
    executeOpenClinicalDocumentPrint: vi.fn(),
  };
});

vi.mock('@/services/observability/operationalTelemetryService', () => ({
  recordOperationalOutcome: vi.fn(),
  recordOperationalTelemetry: vi.fn(),
}));

const buildRecord = (status: 'draft' | 'signed' = 'signed'): ClinicalDocumentRecord => ({
  ...createClinicalDocumentDraft({
    templateId: 'epicrisis',
    hospitalId: 'hhr',
    actor: {
      uid: 'u1',
      email: 'doctor@test.com',
      displayName: 'Doctor Test',
      role: 'doctor_urgency',
    },
    episode: {
      patientRut: '11.111.111-1',
      patientName: 'Paciente Test',
      episodeKey: '11.111.111-1__2026-03-06',
      admissionDate: '2026-03-06',
      sourceDailyRecordDate: '2026-03-06',
      sourceBedId: 'R1',
      specialty: 'Medicina',
    },
    patientFieldValues: {
      nombre: 'Paciente Test',
      rut: '11.111.111-1',
      edad: '40a',
      fecnac: '1986-01-01',
      fing: '2026-03-06',
      finf: '2026-03-06',
      hinf: '10:30',
    },
    medico: 'Doctor Test',
    especialidad: 'Medicina',
  }),
  status,
  isLocked: status === 'signed',
});

describe('useClinicalDocumentWorkspaceExportActions', () => {
  const notify = {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };

  let setDraft: React.Dispatch<React.SetStateAction<ClinicalDocumentRecord | null>>;

  beforeEach(() => {
    vi.clearAllMocks();
    setDraft = vi.fn();
    vi.mocked(printOpenUseCase.executeOpenClinicalDocumentPrint).mockResolvedValue(true);
    vi.mocked(pdfExportUseCase.executeExportClinicalDocumentPdf).mockResolvedValue({
      status: 'success',
      data: {
        pdf: {
          exportStatus: 'exported',
          fileId: 'pdf-1',
        },
      },
      issues: [],
    });
  });

  it('warns when attempting to upload an unsigned document', async () => {
    const { result } = renderHook(() =>
      useClinicalDocumentWorkspaceExportActions({
        selectedDocument: buildRecord('draft'),
        hospitalId: 'hhr',
        notify,
        setDraft,
      })
    );

    await act(async () => {
      await result.current.handleUploadPdf();
    });

    expect(notify.warning).toHaveBeenCalledWith(
      'Documento no firmado',
      'Solo los documentos firmados pueden exportarse a Google Drive.'
    );
    expect(pdfExportUseCase.executeExportClinicalDocumentPdf).not.toHaveBeenCalled();
  });

  it('marks the draft as failed when the export use case fails', async () => {
    vi.mocked(pdfExportUseCase.executeExportClinicalDocumentPdf).mockResolvedValue({
      status: 'failed',
      data: null,
      issues: [{ kind: 'unknown', message: 'drive down' }],
    });
    const document = buildRecord('signed');

    const { result } = renderHook(() =>
      useClinicalDocumentWorkspaceExportActions({
        selectedDocument: document,
        hospitalId: 'hhr',
        notify,
        setDraft,
      })
    );

    await act(async () => {
      await result.current.handleUploadPdf();
    });

    expect(notify.error).toHaveBeenCalledWith('Falló la exportación', 'drive down');
    expect(setDraft).toHaveBeenCalledWith(expect.any(Function));
  });

  it('prefers userSafeMessage when the export use case fails', async () => {
    vi.mocked(pdfExportUseCase.executeExportClinicalDocumentPdf).mockResolvedValue({
      status: 'failed',
      data: null,
      userSafeMessage: 'El respaldo en Drive no está disponible temporalmente.',
      issues: [{ kind: 'unknown', message: 'drive raw failure' }],
    });
    const document = buildRecord('signed');

    const { result } = renderHook(() =>
      useClinicalDocumentWorkspaceExportActions({
        selectedDocument: document,
        hospitalId: 'hhr',
        notify,
        setDraft,
      })
    );

    await act(async () => {
      await result.current.handleUploadPdf();
    });

    expect(notify.error).toHaveBeenCalledWith(
      'Falló la exportación',
      'El respaldo en Drive no está disponible temporalmente.'
    );
  });

  it('warns when print preview cannot be prepared', async () => {
    vi.mocked(printOpenUseCase.executeOpenClinicalDocumentPrint).mockResolvedValue(false);
    const document = buildRecord('signed');

    const { result } = renderHook(() =>
      useClinicalDocumentWorkspaceExportActions({
        selectedDocument: document,
        hospitalId: 'hhr',
        notify,
        setDraft,
      })
    );

    await act(async () => {
      await result.current.handlePrint();
    });

    expect(notify.warning).toHaveBeenCalledWith(
      'No se pudo imprimir el documento',
      'Recarga la página e inténtalo nuevamente.'
    );
    expect(pdfExportUseCase.executeExportClinicalDocumentPdf).not.toHaveBeenCalled();
  });

  it('opens print preview and triggers Drive backup for signed documents', async () => {
    const document = buildRecord('signed');

    const { result } = renderHook(() =>
      useClinicalDocumentWorkspaceExportActions({
        selectedDocument: document,
        hospitalId: 'hhr',
        notify,
        setDraft,
      })
    );

    await act(async () => {
      await result.current.handlePrint();
      await Promise.resolve();
    });

    expect(printOpenUseCase.executeOpenClinicalDocumentPrint).toHaveBeenCalledWith(document);
    expect(notify.info).toHaveBeenCalledWith(
      'Vista de impresión abierta',
      'Ajusta escala, márgenes y destino en el cuadro de impresión del navegador.'
    );
    expect(pdfExportUseCase.executeExportClinicalDocumentPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        record: document,
        hospitalId: 'hhr',
        fileName: expect.any(String),
      })
    );
    expect(notify.success).toHaveBeenCalledWith(
      'PDF enviado a Drive',
      'La vista de impresión quedó abierta y el PDF se está respaldando en el Drive institucional.'
    );
  });
});
