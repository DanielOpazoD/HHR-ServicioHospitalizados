import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useClinicalDocumentWorkspaceBootstrap } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceBootstrap';
import { createClinicalDocumentDraft } from '@/features/clinical-documents/domain/factories';
import type { ClinicalDocumentTemplate } from '@/features/clinical-documents/domain/entities';
import * as templateUseCases from '@/application/clinical-documents/clinicalDocumentTemplateUseCases';
import * as clinicalDocumentUseCases from '@/application/clinical-documents/clinicalDocumentUseCases';

const controllerMocks = vi.hoisted(() => ({
  listActiveClinicalDocumentTemplates: vi.fn(),
  buildClinicalDocumentEpisodeContext: vi.fn(),
  hydrateLegacyClinicalDocument: vi.fn(),
}));

vi.mock('@/features/clinical-documents/controllers/clinicalDocumentTemplateController', () => ({
  listActiveClinicalDocumentTemplates: controllerMocks.listActiveClinicalDocumentTemplates,
}));

vi.mock('@/features/clinical-documents/controllers/clinicalDocumentEpisodeController', () => ({
  buildClinicalDocumentEpisodeContext: controllerMocks.buildClinicalDocumentEpisodeContext,
}));

vi.mock('@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController', () => ({
  hydrateLegacyClinicalDocument: controllerMocks.hydrateLegacyClinicalDocument,
}));

vi.mock('@/application/clinical-documents/clinicalDocumentTemplateUseCases', async () => {
  const actual = await vi.importActual<
    typeof import('@/application/clinical-documents/clinicalDocumentTemplateUseCases')
  >('@/application/clinical-documents/clinicalDocumentTemplateUseCases');
  return {
    ...actual,
    executeListActiveClinicalDocumentTemplates: vi.fn(),
    executeSeedClinicalDocumentTemplates: vi.fn(),
  };
});

vi.mock('@/application/clinical-documents/clinicalDocumentUseCases', async () => {
  const actual = await vi.importActual<
    typeof import('@/application/clinical-documents/clinicalDocumentUseCases')
  >('@/application/clinical-documents/clinicalDocumentUseCases');
  return {
    ...actual,
    subscribeClinicalDocumentsByEpisodeKeys: vi.fn(),
  };
});

vi.mock('@/services/observability/operationalTelemetryService', () => ({
  recordOperationalOutcome: vi.fn(),
}));

const localTemplate: ClinicalDocumentTemplate = {
  id: 'epicrisis',
  name: 'Epicrisis local',
  title: 'Epicrisis',
  version: 1,
  patientFields: [],
  sections: [],
  allowCustomTitle: false,
  allowAddSection: false,
  allowClinicalUpdateSections: false,
  status: 'active',
  documentType: 'epicrisis',
  defaultPatientInfoTitle: 'Información del paciente',
  defaultFooterMedicoLabel: 'Médico',
  defaultFooterEspecialidadLabel: 'Especialidad',
};

const remoteTemplate: ClinicalDocumentTemplate = {
  id: 'evolucion',
  name: 'Evolucion remota',
  title: 'Evolución',
  version: 1,
  patientFields: [],
  sections: [],
  allowCustomTitle: false,
  allowAddSection: false,
  allowClinicalUpdateSections: false,
  status: 'active',
  documentType: 'evolucion',
  defaultPatientInfoTitle: 'Información del paciente',
  defaultFooterMedicoLabel: 'Médico',
  defaultFooterEspecialidadLabel: 'Especialidad',
};

const patient = {
  patientName: 'Paciente Test',
  rut: '11.111.111-1',
  specialty: 'Medicina',
};

const buildDocument = () =>
  createClinicalDocumentDraft({
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

describe('useClinicalDocumentWorkspaceBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    controllerMocks.listActiveClinicalDocumentTemplates.mockReturnValue([localTemplate]);
    controllerMocks.buildClinicalDocumentEpisodeContext.mockReturnValue({
      episodeKey: '11.111.111-1__2026-03-06',
      alternateEpisodeKeys: ['11111111-1__2026-03-06'],
      sourceDailyRecordDate: '2026-03-06',
      specialty: 'Medicina',
    });
    controllerMocks.hydrateLegacyClinicalDocument.mockImplementation(document => document);
    vi.mocked(templateUseCases.executeListActiveClinicalDocumentTemplates).mockResolvedValue({
      status: 'success',
      data: [remoteTemplate],
      issues: [],
    });
    vi.mocked(templateUseCases.executeSeedClinicalDocumentTemplates).mockResolvedValue({
      status: 'success',
      data: [localTemplate],
      issues: [],
    });
    vi.mocked(clinicalDocumentUseCases.subscribeClinicalDocumentsByEpisodeKeys).mockImplementation(
      (_episodeKeys, callback) => {
        callback([buildDocument()]);
        return vi.fn();
      }
    );
  });

  it('does not load remote data when the workspace is inactive or unreadable', async () => {
    renderHook(() =>
      useClinicalDocumentWorkspaceBootstrap({
        patient: patient as never,
        currentDateString: '2026-03-06',
        bedId: 'R1',
        isActive: false,
        canRead: false,
        hospitalId: 'hhr',
        role: 'doctor_urgency',
      })
    );

    await Promise.resolve();

    expect(templateUseCases.executeListActiveClinicalDocumentTemplates).not.toHaveBeenCalled();
    expect(clinicalDocumentUseCases.subscribeClinicalDocumentsByEpisodeKeys).not.toHaveBeenCalled();
  });

  it('loads remote templates and hydrates subscription documents', async () => {
    const { result } = renderHook(() =>
      useClinicalDocumentWorkspaceBootstrap({
        patient: patient as never,
        currentDateString: '2026-03-06',
        bedId: 'R1',
        isActive: true,
        canRead: true,
        hospitalId: 'hhr',
        role: 'doctor_urgency',
      })
    );

    await waitFor(() => {
      expect(result.current.templates).toEqual([remoteTemplate]);
      expect(result.current.documents).toHaveLength(1);
      expect(result.current.selectedDocumentId).toBe(result.current.documents[0]?.id);
    });

    expect(clinicalDocumentUseCases.subscribeClinicalDocumentsByEpisodeKeys).toHaveBeenCalledWith(
      ['11.111.111-1__2026-03-06', '11111111-1__2026-03-06'],
      expect.any(Function),
      'hhr'
    );
  });

  it('seeds templates for admin when remote catalog is empty', async () => {
    vi.mocked(templateUseCases.executeListActiveClinicalDocumentTemplates).mockResolvedValue({
      status: 'success',
      data: [],
      issues: [],
    });

    const { result } = renderHook(() =>
      useClinicalDocumentWorkspaceBootstrap({
        patient: patient as never,
        currentDateString: '2026-03-06',
        bedId: 'R1',
        isActive: true,
        canRead: true,
        hospitalId: 'hhr',
        role: 'admin',
      })
    );

    await waitFor(() => {
      expect(templateUseCases.executeSeedClinicalDocumentTemplates).toHaveBeenCalledWith('hhr');
      expect(result.current.templates).toEqual([localTemplate]);
    });
  });

  it('falls back to local templates when admin seeding fails', async () => {
    vi.mocked(templateUseCases.executeListActiveClinicalDocumentTemplates).mockResolvedValue({
      status: 'success',
      data: [],
      issues: [],
    });
    vi.mocked(templateUseCases.executeSeedClinicalDocumentTemplates).mockResolvedValue({
      status: 'failed',
      data: [],
      issues: [{ kind: 'unknown', message: 'seed failed' }],
    });

    const { result } = renderHook(() =>
      useClinicalDocumentWorkspaceBootstrap({
        patient: patient as never,
        currentDateString: '2026-03-06',
        bedId: 'R1',
        isActive: true,
        canRead: true,
        hospitalId: 'hhr',
        role: 'admin',
      })
    );

    await waitFor(() => {
      expect(result.current.templates).toEqual([localTemplate]);
    });
  });

  it('keeps the selected document when the subscription still contains it', async () => {
    let subscriptionCallback: ((docs: ReturnType<typeof buildDocument>[]) => void) | null = null;
    const primary = buildDocument();
    const secondary = { ...buildDocument(), id: 'secondary-doc' };
    vi.mocked(clinicalDocumentUseCases.subscribeClinicalDocumentsByEpisodeKeys).mockImplementation(
      (_episodeKeys, callback) => {
        subscriptionCallback = callback as typeof subscriptionCallback;
        callback([primary, secondary]);
        return vi.fn();
      }
    );

    const { result } = renderHook(() =>
      useClinicalDocumentWorkspaceBootstrap({
        patient: patient as never,
        currentDateString: '2026-03-06',
        bedId: 'R1',
        isActive: true,
        canRead: true,
        hospitalId: 'hhr',
        role: 'doctor_urgency',
      })
    );

    await waitFor(() => {
      expect(result.current.documents).toHaveLength(2);
    });

    act(() => {
      result.current.setSelectedDocumentId('secondary-doc');
    });

    act(() => {
      subscriptionCallback?.([{ ...secondary, title: 'Documento actualizado' }, primary]);
    });

    expect(result.current.selectedDocumentId).toBe('secondary-doc');
  });
});
