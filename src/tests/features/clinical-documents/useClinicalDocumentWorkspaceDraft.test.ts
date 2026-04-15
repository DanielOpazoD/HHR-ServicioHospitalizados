import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createClinicalDocumentDraft } from '@/features/clinical-documents/domain/factories';
import { useClinicalDocumentWorkspaceDraft } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceDraft';

vi.mock('@/features/clinical-documents/hooks/useClinicalDocumentDraftAutosave', () => ({
  useClinicalDocumentDraftAutosave: () => undefined,
}));

vi.mock('@/features/clinical-documents/hooks/useClinicalDocumentDraftRemoteSync', () => ({
  useClinicalDocumentDraftRemoteSync: () => undefined,
}));

describe('useClinicalDocumentWorkspaceDraft', () => {
  it('ignores setDraft calls when the incoming snapshot matches the current draft', () => {
    const draft = createClinicalDocumentDraft({
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

    const { result } = renderHook(() =>
      useClinicalDocumentWorkspaceDraft({
        documents: [],
        selectedDocumentId: null,
        canEdit: true,
        isActive: true,
        hospitalId: 'hhr',
        role: 'doctor_urgency',
        persistReason: 'autosave',
        user: {
          uid: 'u1',
          email: 'doctor@test.com',
          displayName: 'Doctor Test',
        },
      })
    );

    act(() => {
      result.current.setDraft(draft);
    });

    const firstLoadedDraft = result.current.draft;
    expect(firstLoadedDraft).not.toBeNull();

    act(() => {
      result.current.setDraft(structuredClone(firstLoadedDraft));
    });

    expect(result.current.draft).toBe(firstLoadedDraft);
  });
});
