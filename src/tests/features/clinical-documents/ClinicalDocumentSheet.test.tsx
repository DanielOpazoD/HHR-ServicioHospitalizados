import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ClinicalDocumentSheet } from '@/features/clinical-documents/components/ClinicalDocumentSheet';
import { createClinicalDocumentDraft } from '@/features/clinical-documents/domain/factories';
import { getDefaultClinicalDocumentIndicationsCatalog } from '@/features/clinical-documents/services/clinicalDocumentIndicationsCatalogService';
import { getClinicalDocumentPlanSubsectionTitle } from '@/features/clinical-documents/controllers/clinicalDocumentPlanSectionController';

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

const defaultHandlers = {
  onPrint: vi.fn(),
  onUploadPdf: vi.fn(),
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
        indicationsCatalog={getDefaultClinicalDocumentIndicationsCatalog()}
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
      expect.stringContaining('Reposo Absoluto')
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

  it('allows adding a custom indication to the active specialty', async () => {
    const document = buildDocument();

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

    fireEvent.change(screen.getByLabelText(/agregar propia/i), {
      target: { value: 'Curación diaria de herida' },
    });
    fireEvent.click(screen.getByRole('button', { name: /agregar\+/i }));

    await waitFor(() => {
      expect(defaultHandlers.addCustomIndication).toHaveBeenCalledWith(
        'tmt',
        'Curación diaria de herida'
      );
    });
  });

  it('allows editing and deleting previous indications', async () => {
    const document = buildDocument();

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

    fireEvent.click(screen.getByRole('button', { name: /editar indicación reposo absoluto/i }));
    fireEvent.change(screen.getByDisplayValue('Reposo Absoluto'), {
      target: { value: 'Reposo en domicilio' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar indicación reposo absoluto/i }));

    await waitFor(() => {
      expect(defaultHandlers.updateIndication).toHaveBeenCalledWith(
        'tmt',
        expect.any(String),
        'Reposo en domicilio'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /^Eliminar indicación Reposo Relativo$/i }));

    await waitFor(() => {
      expect(defaultHandlers.deleteIndication).toHaveBeenCalledWith('tmt', expect.any(String));
    });
  });
});
