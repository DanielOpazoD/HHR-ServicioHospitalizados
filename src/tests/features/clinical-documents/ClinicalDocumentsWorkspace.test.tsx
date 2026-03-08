import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ClinicalDocumentsWorkspace } from '@/features/clinical-documents/components/ClinicalDocumentsWorkspace';
import { createClinicalDocumentDraft } from '@/features/clinical-documents/domain/factories';
import * as clinicalDocumentUseCases from '@/application/clinical-documents/clinicalDocumentUseCases';
import { ClinicalDocumentRepository } from '@/services/repositories/ClinicalDocumentRepository';
import { ClinicalDocumentTemplateRepository } from '@/services/repositories/ClinicalDocumentTemplateRepository';

const authState = {
  user: { uid: 'u1', email: 'doctor@test.com', displayName: 'Doctor Test' },
  role: 'doctor_urgency',
};

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}));

const notificationApi = {
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
};

vi.mock('@/context/UIContext', () => ({
  useNotification: () => notificationApi,
}));

vi.mock('@/constants/firestorePaths', () => ({
  getActiveHospitalId: () => 'hhr',
}));

vi.mock('@/features/clinical-documents/services/clinicalDocumentPrintPdfService', () => ({
  openClinicalDocumentBrowserPrintPreview: vi.fn(() => true),
}));

const clinicalDocument = createClinicalDocumentDraft({
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
});

clinicalDocument.sections = clinicalDocument.sections.map(section => ({
  ...section,
  content: `${section.title} completo`,
}));

vi.mock('@/services/repositories/ClinicalDocumentRepository', () => ({
  ClinicalDocumentRepository: {
    subscribeByEpisode: vi.fn(),
  },
}));

vi.mock('@/services/repositories/ClinicalDocumentTemplateRepository', () => ({
  ClinicalDocumentTemplateRepository: {
    listActive: vi.fn(),
    seedDefaults: vi.fn(),
  },
}));

vi.mock('@/application/clinical-documents/clinicalDocumentUseCases', async () => {
  const actual = await vi.importActual<
    typeof import('@/application/clinical-documents/clinicalDocumentUseCases')
  >('@/application/clinical-documents/clinicalDocumentUseCases');
  return {
    ...actual,
    executeCreateClinicalDocumentDraft: vi.fn(),
    executePersistClinicalDocumentDraft: vi.fn(),
    executeDeleteClinicalDocument: vi.fn(),
    executeSignClinicalDocument: vi.fn(),
    executeUnsignClinicalDocument: vi.fn(),
    executeExportClinicalDocumentPdf: vi.fn(),
  };
});

describe('ClinicalDocumentsWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis.document, 'execCommand', {
      value: vi.fn(() => true),
      configurable: true,
    });
    authState.user = { uid: 'u1', email: 'doctor@test.com', displayName: 'Doctor Test' };
    authState.role = 'doctor_urgency';

    vi.mocked(ClinicalDocumentTemplateRepository.listActive).mockResolvedValue([
      {
        id: 'epicrisis',
        name: 'Epicrisis',
        title: 'Epicrisis médica',
        version: 1,
        patientFields: [],
        sections: [],
        allowCustomTitle: false,
        allowAddSection: false,
        allowClinicalUpdateSections: false,
        status: 'active',
        documentType: 'epicrisis',
        defaultPatientInfoTitle: 'Información del Paciente',
        defaultFooterMedicoLabel: 'Médico',
        defaultFooterEspecialidadLabel: 'Especialidad',
      },
    ] as any);

    vi.mocked(ClinicalDocumentRepository.subscribeByEpisode).mockImplementation(
      (_episodeKey, callback) => {
        callback([clinicalDocument]);
        return vi.fn();
      }
    );

    vi.mocked(clinicalDocumentUseCases.executeCreateClinicalDocumentDraft).mockResolvedValue({
      status: 'success',
      data: { ...clinicalDocument, id: 'new-doc' },
      issues: [],
    } as any);
    vi.mocked(clinicalDocumentUseCases.executePersistClinicalDocumentDraft).mockResolvedValue({
      status: 'success',
      data: clinicalDocument,
      issues: [],
    } as any);
    vi.mocked(clinicalDocumentUseCases.executeSignClinicalDocument).mockResolvedValue({
      status: 'success',
      data: {
        ...clinicalDocument,
        status: 'signed',
        isLocked: true,
        audit: {
          ...clinicalDocument.audit,
          signedAt: new Date().toISOString(),
          signedBy: {
            uid: 'u1',
            email: 'doctor@test.com',
            displayName: 'Doctor Test',
            role: 'doctor_urgency',
          },
        },
      },
      issues: [],
    } as any);
    vi.mocked(clinicalDocumentUseCases.executeUnsignClinicalDocument).mockResolvedValue({
      status: 'success',
      data: { ...clinicalDocument, status: 'draft', isLocked: false },
      issues: [],
    } as any);
    vi.mocked(clinicalDocumentUseCases.executeDeleteClinicalDocument).mockResolvedValue({
      status: 'success',
      data: null,
      issues: [],
    } as any);
    vi.mocked(clinicalDocumentUseCases.executeExportClinicalDocumentPdf).mockResolvedValue({
      status: 'success',
      data: { pdf: { exportStatus: 'exported' } },
      issues: [],
    } as any);
  });

  it('renders the real shell and wires create/save/sign/pdf through use-case boundaries', async () => {
    render(
      <ClinicalDocumentsWorkspace
        patient={
          {
            patientName: 'Paciente Test',
            rut: '11.111.111-1',
            admissionDate: '2026-03-06',
            age: '40a',
            birthDate: '1986-01-01',
          } as any
        }
        currentDateString="2026-03-06"
        bedId="R1"
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Doctor Test')).toBeInTheDocument();
    });

    const antecedentesEditor = screen.getByRole('textbox', { name: /contenido antecedentes/i });
    antecedentesEditor.innerHTML = 'Antecedentes actualizados';
    fireEvent.input(antecedentesEditor);
    fireEvent.click(screen.getByRole('button', { name: /crear documento/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    fireEvent.click(screen.getByRole('button', { name: /firmar/i }));
    fireEvent.click(screen.getByRole('button', { name: /pdf/i }));

    await waitFor(() => {
      expect(clinicalDocumentUseCases.executeCreateClinicalDocumentDraft).toHaveBeenCalled();
      expect(clinicalDocumentUseCases.executePersistClinicalDocumentDraft).toHaveBeenCalled();
      expect(clinicalDocumentUseCases.executeSignClinicalDocument).toHaveBeenCalled();
      expect(clinicalDocumentUseCases.executePersistClinicalDocumentDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({
              title: 'Antecedentes',
              content: 'Antecedentes actualizados',
            }),
          ]),
        }),
        'hhr',
        expect.objectContaining({
          uid: 'u1',
        }),
        'manual'
      );
    });
  });

  it('supports sign -> upload -> unsign on the real shell boundary', async () => {
    render(
      <ClinicalDocumentsWorkspace
        patient={
          {
            patientName: 'Paciente Test',
            rut: '11.111.111-1',
            admissionDate: '2026-03-06',
            age: '40a',
            birthDate: '1986-01-01',
          } as any
        }
        currentDateString="2026-03-06"
        bedId="R1"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /firmar/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /firmar/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /quitar firma/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /drive/i }));
    fireEvent.click(screen.getByRole('button', { name: /quitar firma/i }));

    await waitFor(() => {
      expect(clinicalDocumentUseCases.executeExportClinicalDocumentPdf).toHaveBeenCalled();
      expect(clinicalDocumentUseCases.executeUnsignClinicalDocument).toHaveBeenCalled();
    });
  });

  it('renders read-only sheet actions for nurse role', async () => {
    authState.user = { uid: 'n1', email: 'nurse@test.com', displayName: 'Nurse Test' };
    authState.role = 'nurse_hospital';

    render(
      <ClinicalDocumentsWorkspace
        patient={
          {
            patientName: 'Paciente Test',
            rut: '11.111.111-1',
            admissionDate: '2026-03-06',
            age: '40a',
            birthDate: '1986-01-01',
          } as any
        }
        currentDateString="2026-03-06"
        bedId="R1"
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Doctor Test')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /firmar/i })).toBeDisabled();
  });

  it('allows hiding and restoring sections on the real shell boundary', async () => {
    render(
      <ClinicalDocumentsWorkspace
        patient={
          {
            patientName: 'Paciente Test',
            rut: '11.111.111-1',
            admissionDate: '2026-03-06',
            age: '40a',
            birthDate: '1986-01-01',
          } as any
        }
        currentDateString="2026-03-06"
        bedId="R1"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Antecedentes' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Antecedentes' }));
    fireEvent.click(screen.getByRole('button', { name: /eliminar sección antecedentes/i }));
    expect(
      screen.getByRole('button', { name: /restaurar sección: antecedentes/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /restaurar sección: antecedentes/i }));
    expect(
      screen.getByRole('button', { name: /eliminar sección antecedentes/i })
    ).toBeInTheDocument();
  });
});
