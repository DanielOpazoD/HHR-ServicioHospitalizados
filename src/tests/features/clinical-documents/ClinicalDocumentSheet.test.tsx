import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ClinicalDocumentSheet } from '@/features/clinical-documents/components/ClinicalDocumentSheet';
import { createClinicalDocumentDraft } from '@/features/clinical-documents/domain/factories';
import { getDefaultClinicalDocumentIndicationsCatalog } from '@/features/clinical-documents/services/clinicalDocumentIndicationsCatalogService';
import { getClinicalDocumentPlanSubsectionTitle } from '@/features/clinical-documents/controllers/clinicalDocumentPlanSectionController';

const buildDocument = () => {
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
      specialty: 'Cirugía',
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
    especialidad: 'Cirugía',
  });
  // The default plan layout is 'unified' (single editor); these tests assert
  // the 3-subsection split layout, so opt in explicitly here.
  return {
    ...draft,
    sections: draft.sections.map(section =>
      section.id === 'plan' ? { ...section, layout: 'structured' as const } : section
    ),
  };
};

const buildToolbar = (handlers: { onPrint: () => void; onRestoreTemplate: () => void }) => (
  <>
    <button type="button" aria-label="PDF" onClick={handlers.onPrint}>
      PDF
    </button>
    <button type="button" aria-label="Reestablecer plantilla" onClick={handlers.onRestoreTemplate}>
      Reestablecer plantilla
    </button>
    <button type="button" aria-label="Formato" aria-pressed="true">
      Formato
    </button>
    <button type="button" aria-label="Deshacer" disabled>
      Deshacer
    </button>
    <button type="button" aria-label="Rehacer" disabled>
      Rehacer
    </button>
    <button type="button" aria-label="Negrita">
      Negrita
    </button>
    <button type="button" aria-label="Guardado en Drive">
      Guardado en Drive
    </button>
  </>
);

const buildPersonalIndicationsCatalog = (
  tabs: Array<{
    id: string;
    label: string;
    items: Array<{ id: string; text: string; source: 'custom' }>;
  }>,
  activeTabId = tabs[0]?.id || 'general'
) => ({
  ...getDefaultClinicalDocumentIndicationsCatalog(),
  activeTabId,
  tabs,
  items: tabs.find(tab => tab.id === activeTabId)?.items || [],
});

const defaultHandlers = {
  onPrint: vi.fn(),
  onUploadPdf: vi.fn(),
  hasLocalDraftChanges: false,
  flushPendingAutosave: vi.fn(),
  onRestoreTemplate: vi.fn(),
  activeTitleTarget: null,
  activeEditorSectionId: null,
  onSetActiveTitleTarget: vi.fn(),
  draggedSectionId: null,
  dragOverSectionId: null,
  activePlanSubsectionId: 'generales' as const,
  activeIndicationsSpecialtyId: 'tmt' as const,
  isIndicationsPanelOpen: false,
  onSetActivePlanSubsectionId: vi.fn(),
  onSetActiveIndicationsSpecialtyId: vi.fn(),
  onToggleIndicationsPanel: vi.fn(),
  onEditorActivate: vi.fn(),
  onEditorDeactivate: vi.fn(),
  dragHandlers: {
    onDragStart: vi.fn(),
    onDragOver: vi.fn(),
    onDragLeave: vi.fn(),
    onDragEnd: vi.fn(),
  },
  patchDocumentTitle: vi.fn(),
  patchPatientInfoTitle: vi.fn(),
  patchPatientField: vi.fn(),
  patchPatientFieldLabel: vi.fn(),
  setPatientFieldVisibility: vi.fn(),
  patchSectionTitle: vi.fn(),
  patchSection: vi.fn(),
  setSectionLayout: vi.fn(),
  setSectionVisibility: vi.fn(),
  moveSection: vi.fn(),
  reorderSection: vi.fn(),
  addSection: vi.fn(),
  patchFooterLabel: vi.fn(),
  patchDocumentMeta: vi.fn(),
  createIndicationsTab: vi.fn(async () => true),
  renameIndicationsTab: vi.fn(async () => true),
  deleteIndicationsTab: vi.fn(async () => true),
  reorderIndicationsTab: vi.fn(async () => true),
  addCustomIndication: vi.fn(async () => true),
  updateIndication: vi.fn(async () => true),
  deleteIndication: vi.fn(async () => true),
  importIndicationsCatalog: vi.fn(async () => true),
  addClinicalUpdate: vi.fn(),
  patchAnnexContent: vi.fn(),
  setAnnexIncludedInPrint: vi.fn(),
  clearAnnexContent: vi.fn(),
  onPrintAnnex: vi.fn(),
  patchIeehDraft: vi.fn(),
  clearIeehDraft: vi.fn(),
  patchUpdateDate: vi.fn(),
  patchUpdateTime: vi.fn(),
};

describe('ClinicalDocumentSheet', () => {
  beforeEach(() => {
    Object.values(defaultHandlers).forEach(handler => {
      if (typeof handler === 'function' && 'mockClear' in handler) {
        handler.mockClear();
      }
    });
  });

  it('shows empty state when there is no selected document', () => {
    render(
      <ClinicalDocumentSheet
        selectedDocument={null}
        canEdit={true}
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[]}
        indicationsCatalog={getDefaultClinicalDocumentIndicationsCatalog()}
        isSavingCustomIndication={false}
        customIndicationError={null}
        {...defaultHandlers}
        toolbar={buildToolbar(defaultHandlers)}
      />
    );

    expect(
      screen.getByText(/selecciona o crea un documento clínico para comenzar/i)
    ).toBeInTheDocument();
  });

  it('renders editor, local logos and delegates sheet actions', () => {
    const document = buildDocument();
    const personalCatalog = buildPersonalIndicationsCatalog([
      {
        id: 'general',
        label: 'General',
        items: [{ id: 'item-reposo', text: 'Reposo Absoluto', source: 'custom' as const }],
      },
    ]);
    Object.defineProperty(globalThis.document, 'execCommand', {
      value: vi.fn(() => true),
      configurable: true,
    });
    render(
      <ClinicalDocumentSheet
        selectedDocument={document}
        canEdit={true}
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[{ message: 'Falta completar diagnóstico.' }]}
        indicationsCatalog={personalCatalog}
        isSavingCustomIndication={false}
        customIndicationError={null}
        {...defaultHandlers}
        activeTitleTarget="section:antecedentes"
        isIndicationsPanelOpen={true}
        toolbar={buildToolbar(defaultHandlers)}
      />
    );

    expect(screen.getByDisplayValue(document.medico)).toBeInTheDocument();
    expect(screen.queryByText(/revisión antes de imprimir o exportar/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/documento sin alertas obligatorias visibles/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/falta completar diagnóstico/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(getClinicalDocumentPlanSubsectionTitle('generales'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(getClinicalDocumentPlanSubsectionTitle('farmacologicas'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(getClinicalDocumentPlanSubsectionTitle('control_clinico'))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        /hay cambios remotos pendientes\. guarda o recarga el documento para sincronizar/i
      )
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /recargar remoto/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /descartar local/i })).not.toBeInTheDocument();
    expect(screen.getByAltText(/logo institucional izquierdo/i)).toHaveAttribute(
      'src',
      '/images/logos/logo_HHR.png'
    );
    expect(screen.getByAltText(/logo institucional derecho/i)).toHaveAttribute(
      'src',
      '/images/logos/logo_SSMO.jpg'
    );
    expect(
      screen.queryByText(/aplica formato sobre la sección que tengas seleccionada/i)
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /pdf/i }));
    fireEvent.click(screen.getByRole('button', { name: /reestablecer plantilla/i }));
    fireEvent.click(screen.getByRole('button', { name: /formato/i }));
    expect(screen.getByRole('button', { name: /deshacer/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /rehacer/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /negrita/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Reposo Absoluto$/i }));
    fireEvent.click(screen.getByRole('button', { name: /bajar sección antecedentes/i }));
    fireEvent.click(screen.getByRole('button', { name: /eliminar sección antecedentes/i }));
    expect(defaultHandlers.onPrint).toHaveBeenCalled();
    expect(defaultHandlers.onRestoreTemplate).toHaveBeenCalled();
    expect(defaultHandlers.patchSection).toHaveBeenCalledWith(
      'plan',
      expect.stringContaining('- Reposo Absoluto')
    );
    expect(defaultHandlers.moveSection).toHaveBeenCalledWith('antecedentes', 'down');
    expect(defaultHandlers.setSectionVisibility).toHaveBeenCalledWith('antecedentes', false);
    expect(screen.getByRole('button', { name: /^formato$/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('marks the active section and annex with stronger visual state', () => {
    const clinicalDocument = buildDocument();
    clinicalDocument.annexContent = '<p>Anexo activo</p>';

    render(
      <ClinicalDocumentSheet
        selectedDocument={clinicalDocument}
        canEdit={true}
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[]}
        indicationsCatalog={getDefaultClinicalDocumentIndicationsCatalog()}
        isSavingCustomIndication={false}
        customIndicationError={null}
        {...defaultHandlers}
        activeEditorSectionId="annexes"
        toolbar={buildToolbar(defaultHandlers)}
      />
    );

    expect(globalThis.document.querySelector('[data-clinical-section-id="annexes"]')).toHaveClass(
      'is-editor-active'
    );
    expect(screen.getByText(/paciente:/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('allows toggling annex global print and printing only the annex', () => {
    const clinicalDocument = buildDocument();
    clinicalDocument.annexContent = '<p>Anexo activo</p>';

    render(
      <ClinicalDocumentSheet
        selectedDocument={clinicalDocument}
        canEdit={true}
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[]}
        indicationsCatalog={getDefaultClinicalDocumentIndicationsCatalog()}
        isSavingCustomIndication={false}
        customIndicationError={null}
        {...defaultHandlers}
        toolbar={buildToolbar(defaultHandlers)}
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /imprimir solo anexo/i }));

    expect(defaultHandlers.setAnnexIncludedInPrint).toHaveBeenCalledWith(false);
    expect(defaultHandlers.onPrintAnnex).toHaveBeenCalledTimes(1);
  });

  it('shows drive link and saved state when the PDF is exported to institutional drive', () => {
    const document = buildDocument();
    document.pdf = {
      exportStatus: 'exported',
      webViewLink: 'https://drive.google.com/test-file',
    };

    render(
      <ClinicalDocumentSheet
        selectedDocument={document}
        canEdit={true}
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[]}
        indicationsCatalog={getDefaultClinicalDocumentIndicationsCatalog()}
        isSavingCustomIndication={false}
        customIndicationError={null}
        {...defaultHandlers}
        isIndicationsPanelOpen={true}
        toolbar={buildToolbar(defaultHandlers)}
      />
    );

    expect(
      screen.getByRole('button', { name: /panel de indicaciones predeterminadas/i })
    ).toBeInTheDocument();
  });

  it('shows personal default indications without specialty tabs', async () => {
    const document = buildDocument();
    const personalCatalog = buildPersonalIndicationsCatalog([
      {
        id: 'general',
        label: 'General',
        items: [{ id: 'item-1', text: 'Reposo relativo personalizado', source: 'custom' as const }],
      },
      {
        id: 'farmacos',
        label: 'Fármacos',
        items: [],
      },
    ]);

    render(
      <ClinicalDocumentSheet
        selectedDocument={document}
        canEdit={true}
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[]}
        indicationsCatalog={personalCatalog}
        isSavingCustomIndication={false}
        customIndicationError={null}
        {...defaultHandlers}
        isIndicationsPanelOpen={true}
        toolbar={buildToolbar(defaultHandlers)}
      />
    );

    expect(screen.getByRole('heading', { name: /mis indicaciones/i })).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: /especialidades/i })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /general/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /fármacos/i })).toBeInTheDocument();
    expect(screen.getByText('Reposo relativo personalizado')).toBeInTheDocument();
    expect(screen.queryByText('Propia')).not.toBeInTheDocument();
  });

  it('allows managing personal indication tabs', async () => {
    const document = buildDocument();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const personalCatalog = buildPersonalIndicationsCatalog([
      {
        id: 'general',
        label: 'General',
        items: [],
      },
      {
        id: 'farmacos',
        label: 'Fármacos',
        items: [],
      },
    ]);

    render(
      <ClinicalDocumentSheet
        selectedDocument={document}
        canEdit={true}
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[]}
        indicationsCatalog={personalCatalog}
        isSavingCustomIndication={false}
        customIndicationError={null}
        {...defaultHandlers}
        isIndicationsPanelOpen={true}
        toolbar={buildToolbar(defaultHandlers)}
      />
    );

    expect(screen.queryByLabelText(/nueva pestaña de indicaciones/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /renombrar pestaña general/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /eliminar pestaña fármacos/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /mover pestaña fármacos a la izquierda/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /mover pestaña general a la derecha/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar nueva indicación/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /configurar pestañas/i }));
    fireEvent.change(screen.getByLabelText(/nueva pestaña de indicaciones/i), {
      target: { value: 'Post operatorio' },
    });
    fireEvent.click(screen.getByRole('button', { name: /crear pestaña de indicaciones/i }));
    await waitFor(() => {
      expect(defaultHandlers.createIndicationsTab).toHaveBeenCalledWith('Post operatorio');
    });

    fireEvent.click(screen.getByRole('button', { name: /renombrar pestaña general/i }));
    fireEvent.change(screen.getByDisplayValue('General'), {
      target: { value: 'Generales alta' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar nombre de pestaña general/i }));
    await waitFor(() => {
      expect(defaultHandlers.renameIndicationsTab).toHaveBeenCalledWith(
        'general',
        'Generales alta'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /eliminar pestaña fármacos/i }));
    expect(defaultHandlers.deleteIndicationsTab).toHaveBeenCalledWith('farmacos');
    expect(confirmSpy).toHaveBeenCalledWith(
      '¿Eliminar la pestaña "Fármacos" y sus indicaciones guardadas? Esta acción no se puede deshacer.'
    );

    confirmSpy.mockRestore();
  });

  it('allows adding a custom personal indication into the active tab', async () => {
    const document = buildDocument();
    const personalCatalog = buildPersonalIndicationsCatalog(
      [
        {
          id: 'farmacos',
          label: 'Fármacos',
          items: [],
        },
      ],
      'farmacos'
    );

    render(
      <ClinicalDocumentSheet
        selectedDocument={document}
        canEdit={true}
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[]}
        indicationsCatalog={personalCatalog}
        isSavingCustomIndication={false}
        customIndicationError={null}
        {...defaultHandlers}
        isIndicationsPanelOpen={true}
        toolbar={buildToolbar(defaultHandlers)}
      />
    );

    expect(screen.queryByLabelText(/agregar propia/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /agregar nueva indicación/i }));
    fireEvent.change(screen.getByLabelText(/agregar propia/i), {
      target: { value: 'Curación diaria de herida' },
    });
    fireEvent.click(screen.getByRole('button', { name: /agregar\+/i }));

    await waitFor(() => {
      expect(defaultHandlers.addCustomIndication).toHaveBeenCalledWith(
        'farmacos',
        'Curación diaria de herida'
      );
    });
  });

  it('allows editing and deleting personal indications', async () => {
    const document = buildDocument();
    const personalCatalog = buildPersonalIndicationsCatalog(
      [
        {
          id: 'postop',
          label: 'Post operatorio',
          items: [
            { id: 'personal-1', text: 'Reposo personalizado', source: 'custom' as const },
            { id: 'personal-2', text: 'Control personalizado', source: 'custom' as const },
          ],
        },
      ],
      'postop'
    );

    render(
      <ClinicalDocumentSheet
        selectedDocument={document}
        canEdit={true}
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[]}
        indicationsCatalog={personalCatalog}
        isSavingCustomIndication={false}
        customIndicationError={null}
        {...defaultHandlers}
        isIndicationsPanelOpen={true}
        toolbar={buildToolbar(defaultHandlers)}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /editar indicación reposo personalizado/i })
    );
    fireEvent.change(screen.getByDisplayValue('Reposo personalizado'), {
      target: { value: 'Reposo en domicilio' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /guardar indicación reposo personalizado/i })
    );

    await waitFor(() => {
      expect(defaultHandlers.updateIndication).toHaveBeenCalledWith(
        'postop',
        'personal-1',
        'Reposo en domicilio'
      );
    });

    fireEvent.click(
      screen.getByRole('button', { name: /^Eliminar indicación Control personalizado$/i })
    );

    await waitFor(() => {
      expect(defaultHandlers.deleteIndication).toHaveBeenCalledWith('postop', 'personal-2');
    });
  });

  it('inserts a personal indication without changing unified plan into structured sections', () => {
    const document = buildDocument();
    const unifiedDocument = {
      ...document,
      sections: document.sections.map(section =>
        section.id === 'plan'
          ? { ...section, layout: 'unified' as const, content: '<div>Indicaciones previas</div>' }
          : section
      ),
    };
    const personalCatalog = buildPersonalIndicationsCatalog([
      {
        id: 'general',
        label: 'General',
        items: [{ id: 'item-reposo', text: 'Reposo Absoluto', source: 'custom' as const }],
      },
    ]);

    render(
      <ClinicalDocumentSheet
        selectedDocument={unifiedDocument}
        canEdit={true}
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[]}
        indicationsCatalog={personalCatalog}
        isSavingCustomIndication={false}
        customIndicationError={null}
        {...defaultHandlers}
        isIndicationsPanelOpen={true}
        toolbar={buildToolbar(defaultHandlers)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Reposo Absoluto$/i }));

    expect(defaultHandlers.patchSection).toHaveBeenCalledWith(
      'plan',
      expect.stringContaining('- Reposo Absoluto')
    );
    expect(defaultHandlers.patchSection).toHaveBeenCalledWith(
      'plan',
      expect.not.stringContaining('Indicaciones farmacológicas')
    );
  });
});
