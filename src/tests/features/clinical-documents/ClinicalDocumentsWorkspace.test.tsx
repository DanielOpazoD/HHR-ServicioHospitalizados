import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ClinicalDocumentsWorkspace } from '@/features/clinical-documents/components/ClinicalDocumentsWorkspace';
import { createClinicalDocumentDraft } from '@/features/clinical-documents/domain/factories';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'u1', email: 'doctor@test.com', displayName: 'Doctor Test' },
    role: 'doctor_urgency',
  }),
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

const document = createClinicalDocumentDraft({
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

const mockBootstrapState = {
  templates: [{ id: 'epicrisis', name: 'Epicrisis' }],
  selectedTemplateId: 'epicrisis',
  setSelectedTemplateId: vi.fn(),
  documents: [document],
  selectedDocumentId: document.id,
  setSelectedDocumentId: vi.fn(),
  episode: {
    patientRut: '11.111.111-1',
    patientName: 'Paciente Test',
    episodeKey: '11.111.111-1__2026-03-06',
    admissionDate: '2026-03-06',
    sourceDailyRecordDate: '2026-03-06',
    sourceBedId: 'R1',
    specialty: 'Medicina',
  },
};

const mockDraftState = {
  draft: document,
  setDraft: vi.fn(),
  isSaving: false,
  setIsSaving: vi.fn(),
  validationIssues: [],
  lastPersistedSnapshotRef: { current: '' },
  patchPatientField: vi.fn(),
  patchSection: vi.fn(),
  patchSectionTitle: vi.fn(),
  patchDocumentTitle: vi.fn(),
  patchPatientInfoTitle: vi.fn(),
  patchFooterLabel: vi.fn(),
  patchDocumentMeta: vi.fn(),
};

const mockDocumentActions = {
  createDocument: vi.fn(),
  handleDeleteDocument: vi.fn(),
  handleSaveNow: vi.fn(),
  handleSign: vi.fn(),
  handleUnsign: vi.fn(),
};

const mockExportActions = {
  handlePrint: vi.fn(),
  handleUploadPdf: vi.fn(),
  isUploadingPdf: false,
};

vi.mock('@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceBootstrap', () => ({
  useClinicalDocumentWorkspaceBootstrap: () => mockBootstrapState,
}));

vi.mock('@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceDraft', () => ({
  useClinicalDocumentWorkspaceDraft: () => mockDraftState,
}));

vi.mock('@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceDocumentActions', () => ({
  useClinicalDocumentWorkspaceDocumentActions: () => mockDocumentActions,
}));

vi.mock('@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceExportActions', () => ({
  useClinicalDocumentWorkspaceExportActions: () => mockExportActions,
}));

describe('ClinicalDocumentsWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wires sidebar and sheet actions through the shell', () => {
    render(
      <ClinicalDocumentsWorkspace
        patient={{ patientName: 'Paciente Test', rut: '11.111.111-1' } as any}
        currentDateString="2026-03-06"
        bedId="R1"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /crear documento/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    fireEvent.click(screen.getByRole('button', { name: /firmar/i }));
    fireEvent.click(screen.getByRole('button', { name: /pdf/i }));

    expect(mockDocumentActions.createDocument).toHaveBeenCalled();
    expect(mockDocumentActions.handleSaveNow).toHaveBeenCalled();
    expect(mockDocumentActions.handleSign).toHaveBeenCalled();
    expect(mockExportActions.handlePrint).toHaveBeenCalled();
  });
});
