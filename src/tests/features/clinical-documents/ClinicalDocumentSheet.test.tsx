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

const defaultHandlers = {
  onApplyPendingRemoteUpdate: vi.fn(),
  onDiscardLocalDraftChanges: vi.fn(),
  onSave: vi.fn(),
  onSign: vi.fn(),
  onUnsign: vi.fn(),
  onPrint: vi.fn(),
  onUploadPdf: vi.fn(),
  onResetDocumentContent: vi.fn(),
  patchDocumentTitle: vi.fn(),
  patchPatientInfoTitle: vi.fn(),
  patchPatientField: vi.fn(),
  patchPatientFieldLabel: vi.fn(),
  setPatientFieldVisibility: vi.fn(),
  patchSectionTitle: vi.fn(),
  patchSection: vi.fn(),
  appendSectionText: vi.fn(),
  setSectionVisibility: vi.fn(),
  moveSection: vi.fn(),
  reorderSection: vi.fn(),
  patchFooterLabel: vi.fn(),
  patchDocumentMeta: vi.fn(),
  addCustomIndication: vi.fn(async () => true),
  updateIndication: vi.fn(async () => true),
  deleteIndication: vi.fn(async () => true),
  importIndicationsCatalog: vi.fn(async () => true),
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
        hasPendingRemoteUpdate={false}
        canEdit={true}
        canUnsignSelectedDocument={false}
        role="doctor_urgency"
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[]}
        indicationsCatalog={getDefaultClinicalDocumentIndicationsCatalog()}
        isSavingCustomIndication={false}
        customIndicationError={null}
        {...defaultHandlers}
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
        hasPendingRemoteUpdate={true}
        hasLocalDraftChanges={true}
        canEdit={true}
        canUnsignSelectedDocument={false}
        role="doctor_urgency"
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[{ message: 'Falta completar diagnóstico.' }]}
        indicationsCatalog={getDefaultClinicalDocumentIndicationsCatalog()}
        isSavingCustomIndication={false}
        customIndicationError={null}
        {...defaultHandlers}
      />
    );

    expect(screen.getByDisplayValue(document.medico)).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: /pdf/i }));
    fireEvent.click(screen.getByRole('button', { name: /reiniciar/i }));
    fireEvent.click(screen.getByRole('button', { name: /formato/i }));
    expect(screen.getByRole('button', { name: /deshacer/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /rehacer/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /negrita/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /abrir panel de indicaciones predeterminadas/i })
    );
    fireEvent.click(screen.getByRole('tab', { name: /TMT/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Reposo Absoluto$/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Antecedentes' }));
    fireEvent.click(screen.getByRole('button', { name: /bajar sección antecedentes/i }));
    const dataTransfer = {
      effectAllowed: 'move',
      setData: vi.fn(),
      getData: vi.fn(),
    };
    fireEvent.dragStart(screen.getByRole('button', { name: /arrastrar sección antecedentes/i }), {
      dataTransfer,
    });
    const historiaSectionBlock = screen
      .getByText('Historia y evolución clínica')
      .closest('.clinical-document-section-block');
    expect(historiaSectionBlock).not.toBeNull();
    fireEvent.dragOver(historiaSectionBlock!, { dataTransfer });
    fireEvent.drop(historiaSectionBlock!, { dataTransfer });
    fireEvent.click(screen.getByRole('button', { name: /eliminar sección antecedentes/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Nombre' }));
    fireEvent.click(screen.getByRole('button', { name: /eliminar campo nombre/i }));
    expect(defaultHandlers.onPrint).toHaveBeenCalled();
    expect(defaultHandlers.onResetDocumentContent).toHaveBeenCalled();
    expect(defaultHandlers.patchSection).toHaveBeenCalledWith(
      'plan',
      expect.stringContaining('Reposo Absoluto')
    );
    expect(defaultHandlers.moveSection).toHaveBeenCalledWith('antecedentes', 'down');
    expect(defaultHandlers.reorderSection).toHaveBeenCalledWith(
      'antecedentes',
      'historia-evolucion'
    );
    expect(defaultHandlers.setSectionVisibility).toHaveBeenCalledWith('antecedentes', false);
    expect(defaultHandlers.setPatientFieldVisibility).toHaveBeenCalledWith('nombre', false);
  });

  it('shows drive link and saved state when the PDF is exported to institutional drive', () => {
    const document = buildDocument();
    document.status = 'signed';
    document.isLocked = true;
    document.pdf = {
      exportStatus: 'exported',
      webViewLink: 'https://drive.google.com/test-file',
    };

    render(
      <ClinicalDocumentSheet
        selectedDocument={document}
        hasPendingRemoteUpdate={false}
        canEdit={true}
        canUnsignSelectedDocument={true}
        role="doctor_urgency"
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[]}
        indicationsCatalog={getDefaultClinicalDocumentIndicationsCatalog()}
        isSavingCustomIndication={false}
        customIndicationError={null}
        {...defaultHandlers}
      />
    );

    expect(screen.getByRole('button', { name: /guardado en drive/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /abrir drive/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /indicaciones predeterminadas/i })
    ).not.toBeInTheDocument();
  });

  it('allows adding a custom indication to the active specialty', async () => {
    const document = buildDocument();

    render(
      <ClinicalDocumentSheet
        selectedDocument={document}
        hasPendingRemoteUpdate={false}
        canEdit={true}
        canUnsignSelectedDocument={false}
        role="doctor_urgency"
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[]}
        indicationsCatalog={getDefaultClinicalDocumentIndicationsCatalog()}
        isSavingCustomIndication={false}
        customIndicationError={null}
        {...defaultHandlers}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /abrir panel de indicaciones predeterminadas/i })
    );
    fireEvent.click(screen.getByRole('tab', { name: /TMT/i }));
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
        hasPendingRemoteUpdate={false}
        canEdit={true}
        canUnsignSelectedDocument={false}
        role="doctor_urgency"
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[]}
        indicationsCatalog={getDefaultClinicalDocumentIndicationsCatalog()}
        isSavingCustomIndication={false}
        customIndicationError={null}
        {...defaultHandlers}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /abrir panel de indicaciones predeterminadas/i })
    );
    fireEvent.click(screen.getByRole('tab', { name: /TMT/i }));
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
