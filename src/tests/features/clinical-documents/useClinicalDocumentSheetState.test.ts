import { act, fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ClinicalDocumentSheetEditorApi } from '@/features/clinical-documents/components/clinicalDocumentSheetShared';
import { createClinicalDocumentDraft } from '@/features/clinical-documents/domain/factories';
import { useClinicalDocumentSheetState } from '@/features/clinical-documents/hooks/useClinicalDocumentSheetState';

const createDocument = (overrides?: { id?: string; specialty?: string; isLocked?: boolean }) =>
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
      episodeKey: `${overrides?.id ?? 'doc-1'}__2026-03-06`,
      admissionDate: '2026-03-06',
      sourceDailyRecordDate: '2026-03-06',
      sourceBedId: 'R1',
      specialty: overrides?.specialty ?? 'Medicina',
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
    especialidad: overrides?.specialty ?? 'Medicina',
  });

describe('useClinicalDocumentSheetState', () => {
  it('resets document-scoped UI state when the selected document changes', () => {
    const firstDocument = createDocument({ id: 'doc-1', specialty: 'Medicina' });
    const secondDocument = {
      ...createDocument({ id: 'doc-2', specialty: 'Pediatría' }),
      id: 'doc-2',
    };

    const { result, rerender } = renderHook(
      ({ selectedDocument }) => useClinicalDocumentSheetState(selectedDocument),
      {
        initialProps: { selectedDocument: firstDocument },
      }
    );

    act(() => {
      result.current.setIsIndicationsPanelOpen(true);
      result.current.setActivePlanSubsectionId('control_clinico');
      result.current.setActiveIndicationsSpecialtyId('cirugia');
    });

    expect(result.current.isIndicationsPanelOpen).toBe(true);
    expect(result.current.activePlanSubsectionId).toBe('control_clinico');
    expect(result.current.activeIndicationsSpecialtyId).toBe('cirugia');

    rerender({ selectedDocument: secondDocument });

    expect(result.current.isIndicationsPanelOpen).toBe(false);
    expect(result.current.activePlanSubsectionId).toBe('generales');
    expect(result.current.activeIndicationsSpecialtyId).not.toBe('cirugia');
    expect(result.current.activeIndicationsSpecialtyId).toBe('pediatria');
  });

  it('routes formatting and html insertion through the active and last active editor', () => {
    const selectedDocument = createDocument();
    const focus = vi.fn();
    const applyCommand = vi.fn();
    const insertHtml = vi.fn();
    const editorElement = document.createElement('div');

    editorElement.focus = focus;

    const editorApi: ClinicalDocumentSheetEditorApi = {
      element: editorElement,
      canUndo: true,
      canRedo: false,
      applyCommand,
      insertHtml,
    };

    const { result } = renderHook(() => useClinicalDocumentSheetState(selectedDocument));

    expect(result.current.formattingDisabled).toBe(true);

    act(() => {
      result.current.handleEditorActivate('section-1', editorApi);
    });

    expect(result.current.formattingDisabled).toBe(false);
    expect(result.current.activeEditorSectionId).toBe('section-1');
    expect(result.current.activeEditorHistoryState).toEqual({ canUndo: true, canRedo: false });

    act(() => {
      result.current.applyFormatting('bold');
      result.current.insertHtml('<p>Hola</p>');
      result.current.handleEditorDeactivate('section-1');
      result.current.applyFormatting('undo');
    });

    expect(focus).toHaveBeenCalledTimes(3);
    expect(applyCommand).toHaveBeenNthCalledWith(1, 'bold', undefined);
    expect(applyCommand).toHaveBeenNthCalledWith(2, 'undo', undefined);
    expect(insertHtml).toHaveBeenCalledWith('<p>Hola</p>');
    expect(result.current.activeEditorSectionId).toBeNull();
  });

  it('tracks drag state and ignores drag-over when interaction is disabled', () => {
    const { result } = renderHook(() => useClinicalDocumentSheetState(createDocument()));
    const preventDefault = vi.fn();
    const setData = vi.fn();

    act(() => {
      result.current.sectionDragHandlers.onDragStart(
        {
          dataTransfer: {
            effectAllowed: '',
            setData,
          },
        } as unknown as React.DragEvent<HTMLButtonElement>,
        'section-1'
      );
    });

    expect(result.current.draggedSectionId).toBe('section-1');
    expect(setData).toHaveBeenCalledWith('text/plain', 'section-1');

    act(() => {
      result.current.sectionDragHandlers.onDragOver(
        {
          preventDefault,
        } as unknown as React.DragEvent<HTMLElement>,
        'section-2',
        false
      );
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(result.current.dragOverSectionId).toBeNull();

    act(() => {
      result.current.sectionDragHandlers.onDragOver(
        {
          preventDefault,
        } as unknown as React.DragEvent<HTMLElement>,
        'section-2',
        true
      );
      result.current.sectionDragHandlers.onDragLeave('section-2');
      result.current.sectionDragHandlers.onDragEnd();
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.draggedSectionId).toBeNull();
    expect(result.current.dragOverSectionId).toBeNull();
  });

  it('closes the formatting panel only when double-clicking outside the keep-open surfaces', () => {
    const { result } = renderHook(() => useClinicalDocumentSheetState(createDocument()));
    const keepOpenTarget = document.createElement('div');

    keepOpenTarget.className = 'clinical-document-rich-text-editor';
    document.body.appendChild(keepOpenTarget);

    act(() => {
      result.current.setIsFormattingOpen(true);
    });

    fireEvent.doubleClick(keepOpenTarget);
    expect(result.current.isFormattingOpen).toBe(true);

    fireEvent.doubleClick(document.body);
    expect(result.current.isFormattingOpen).toBe(false);

    keepOpenTarget.remove();
  });
});
