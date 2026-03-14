import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClinicalDocumentsModal } from '@/features/clinical-documents/components/ClinicalDocumentsModal';
import { ClinicalDocumentsPanel } from '@/features/clinical-documents/components/ClinicalDocumentsPanel';
import { ClinicalDocumentDriveFolderPicker } from '@/features/clinical-documents/components/ClinicalDocumentDriveFolderPicker';

const workspaceSpy = vi.fn();

vi.mock('@/features/clinical-documents/components/ClinicalDocumentsWorkspace', () => ({
  ClinicalDocumentsWorkspace: (props: unknown) => {
    workspaceSpy(props);
    return <div data-testid="clinical-documents-workspace">workspace</div>;
  },
}));

const patient = {
  patientName: 'Paciente Test',
  rut: '11.111.111-1',
  admissionDate: '2026-03-06',
} as const;

describe('ClinicalDocuments containers', () => {
  beforeEach(() => {
    workspaceSpy.mockClear();
  });

  it('renders modal header metadata and forwards the active workspace context', () => {
    render(
      <ClinicalDocumentsModal
        isOpen={true}
        onClose={vi.fn()}
        patient={patient as never}
        currentDateString="2026-03-13"
        bedId="B-12"
      />
    );

    expect(screen.getByText('Documentos Clínicos')).toBeInTheDocument();
    expect(screen.getByText(/Paciente Test · 11.111.111-1 · 06-03-2026/i)).toBeInTheDocument();
    expect(screen.getByTestId('clinical-documents-workspace')).toBeInTheDocument();
    expect(workspaceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        patient,
        currentDateString: '2026-03-13',
        bedId: 'B-12',
        isActive: true,
      })
    );
  });

  it('renders the side panel shell with episode context and a permanently active workspace', () => {
    render(
      <ClinicalDocumentsPanel
        patient={patient as never}
        currentDateString="2026-03-13"
        bedId="B-12"
      />
    );

    expect(screen.getByText('Documentos Clínicos')).toBeInTheDocument();
    expect(
      screen.getByText(/Paciente Test · 11.111.111-1 · 11\.111\.111-1__2026-03-06/i)
    ).toBeInTheDocument();
    expect(workspaceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: true,
      })
    );
  });

  it('renders Drive folder picker states and delegates navigation actions', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const onEnterFolder = vi.fn();
    const onNavigateBreadcrumb = vi.fn();

    render(
      <ClinicalDocumentDriveFolderPicker
        isOpen={true}
        isLoading={false}
        isUploading={false}
        error="Sin acceso temporal"
        currentLocation={{
          id: 'folder-1',
          name: 'Documentos',
          path: 'Mi unidad/Hospitalizados/Documentos',
        }}
        breadcrumbs={[
          { id: 'root', name: 'Mi unidad', path: 'Mi unidad' },
          {
            id: 'folder-1',
            name: 'Documentos',
            path: 'Mi unidad/Hospitalizados/Documentos',
          },
        ]}
        folders={[
          {
            id: 'folder-2',
            name: 'Paciente Demo',
            path: 'Mi unidad/Hospitalizados/Documentos/Paciente Demo',
            parentId: 'folder-1',
          },
        ]}
        onClose={onClose}
        onEnterFolder={onEnterFolder}
        onNavigateBreadcrumb={onNavigateBreadcrumb}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText(/Sin acceso temporal/i)).toBeInTheDocument();
    expect(screen.getByText('Mi unidad/Hospitalizados/Documentos')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mi unidad' }));
    fireEvent.click(screen.getByRole('button', { name: /abrir/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar aquí/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onNavigateBreadcrumb).toHaveBeenCalledWith({
      id: 'root',
      name: 'Mi unidad',
      path: 'Mi unidad',
    });
    expect(onEnterFolder).toHaveBeenCalledWith({
      id: 'folder-2',
      name: 'Paciente Demo',
      path: 'Mi unidad/Hospitalizados/Documentos/Paciente Demo',
      parentId: 'folder-1',
    });
    expect(onConfirm).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows loading and upload-disabled states in the Drive folder picker', () => {
    render(
      <ClinicalDocumentDriveFolderPicker
        isOpen={true}
        isLoading={true}
        isUploading={true}
        error={null}
        currentLocation={{
          id: 'folder-1',
          name: 'Documentos',
          path: 'Mi unidad/Hospitalizados/Documentos',
        }}
        breadcrumbs={[{ id: 'root', name: 'Mi unidad', path: 'Mi unidad' }]}
        folders={[]}
        onClose={vi.fn()}
        onEnterFolder={vi.fn()}
        onNavigateBreadcrumb={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText(/cargando carpetas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled();
  });
});
