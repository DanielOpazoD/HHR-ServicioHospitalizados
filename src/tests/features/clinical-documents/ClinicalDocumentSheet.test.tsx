import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ClinicalDocumentSheet } from '@/features/clinical-documents/components/ClinicalDocumentSheet';
import { createClinicalDocumentDraft } from '@/features/clinical-documents/domain/factories';

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

const defaultHandlers = {
  onSave: vi.fn(),
  onSign: vi.fn(),
  onUnsign: vi.fn(),
  onPrint: vi.fn(),
  onUploadPdf: vi.fn(),
  patchDocumentTitle: vi.fn(),
  patchPatientInfoTitle: vi.fn(),
  patchPatientField: vi.fn(),
  patchPatientFieldLabel: vi.fn(),
  setPatientFieldVisibility: vi.fn(),
  patchSectionTitle: vi.fn(),
  patchSection: vi.fn(),
  setSectionVisibility: vi.fn(),
  moveSection: vi.fn(),
  reorderSection: vi.fn(),
  patchFooterLabel: vi.fn(),
  patchDocumentMeta: vi.fn(),
};

describe('ClinicalDocumentSheet', () => {
  it('shows empty state when there is no selected document', () => {
    render(
      <ClinicalDocumentSheet
        selectedDocument={null}
        canEdit={true}
        canUnsignSelectedDocument={false}
        role="doctor_urgency"
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[]}
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
        canEdit={true}
        canUnsignSelectedDocument={false}
        role="doctor_urgency"
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[{ message: 'Falta completar diagnóstico.' }]}
        {...defaultHandlers}
      />
    );

    expect(screen.getByDisplayValue(document.medico)).toBeInTheDocument();
    expect(screen.getByText(/falta completar diagnóstico/i)).toBeInTheDocument();
    expect(screen.getByAltText(/logo institucional izquierdo/i)).toHaveAttribute(
      'src',
      '/images/logos/logo_HHR.png'
    );
    expect(screen.getByAltText(/logo institucional derecho/i)).toHaveAttribute(
      'src',
      '/images/logos/logo_SSMO.jpg'
    );

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    fireEvent.click(screen.getByRole('button', { name: /pdf/i }));
    fireEvent.click(screen.getByRole('button', { name: /formato/i }));
    expect(screen.getByRole('button', { name: /deshacer/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /rehacer/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /negrita/i }));
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
    expect(defaultHandlers.onSave).toHaveBeenCalled();
    expect(defaultHandlers.onPrint).toHaveBeenCalled();
    expect(defaultHandlers.moveSection).toHaveBeenCalledWith('antecedentes', 'down');
    expect(defaultHandlers.reorderSection).toHaveBeenCalledWith(
      'antecedentes',
      'historia-evolucion'
    );
    expect(defaultHandlers.setSectionVisibility).toHaveBeenCalledWith('antecedentes', false);
    expect(defaultHandlers.setPatientFieldVisibility).toHaveBeenCalledWith('nombre', false);
  });

  it('disables the global formatting toolbar again when the editor loses focus', () => {
    const document = buildDocument();
    Object.defineProperty(globalThis.document, 'execCommand', {
      value: vi.fn(() => true),
      configurable: true,
    });

    render(
      <ClinicalDocumentSheet
        selectedDocument={document}
        canEdit={true}
        canUnsignSelectedDocument={false}
        role="doctor_urgency"
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[]}
        {...defaultHandlers}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /formato/i }));
    const antecedentesEditor = screen.getByRole('textbox', { name: /contenido antecedentes/i });
    fireEvent.focus(antecedentesEditor);

    expect(screen.getByRole('button', { name: /negrita/i })).not.toBeDisabled();

    fireEvent.blur(antecedentesEditor);

    expect(screen.getByRole('button', { name: /negrita/i })).toBeDisabled();
  });
});
