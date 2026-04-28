import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ClinicalDocumentStatusBar } from '@/features/clinical-documents/components/ClinicalDocumentStatusBar';

const defaultStatusProps = {
  hasLocalDraftChanges: false,
  hasPendingRemoteUpdate: false,
  onApplyPendingRemoteUpdate: vi.fn(),
  onDiscardLocalDraftChanges: vi.fn(),
};

describe('ClinicalDocumentStatusBar', () => {
  it('hides autosync banners when there is no pending remote update', () => {
    render(
      <ClinicalDocumentStatusBar
        {...defaultStatusProps}
        hasLocalDraftChanges={false}
        isSaving={false}
        isUploadingPdf={false}
        onUploadPdf={() => {}}
      />
    );

    expect(screen.queryByText(/cambios locales sin guardar/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/actualización remota pendiente/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /recargar remoto/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /descartar local/i })).not.toBeInTheDocument();
  });

  it('shows pending remote sync controls when remote update arrives', () => {
    const onApplyPendingRemoteUpdate = vi.fn();
    const onDiscardLocalDraftChanges = vi.fn();

    render(
      <ClinicalDocumentStatusBar
        {...defaultStatusProps}
        hasPendingRemoteUpdate={true}
        hasLocalDraftChanges={true}
        isSaving={false}
        isUploadingPdf={false}
        onUploadPdf={() => {}}
        onApplyPendingRemoteUpdate={onApplyPendingRemoteUpdate}
        onDiscardLocalDraftChanges={onDiscardLocalDraftChanges}
      />
    );

    expect(screen.getByText(/actualización remota pendiente/i)).toBeInTheDocument();
    expect(screen.getByText(/cambios locales sin guardar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recargar remoto/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descartar local/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /recargar remoto/i }));
    fireEvent.click(screen.getByRole('button', { name: /descartar local/i }));

    expect(onApplyPendingRemoteUpdate).toHaveBeenCalledTimes(1);
    expect(onDiscardLocalDraftChanges).toHaveBeenCalledTimes(1);
  });

  it('shows an exported Drive state with a direct link', () => {
    render(
      <ClinicalDocumentStatusBar
        {...defaultStatusProps}
        isSaving={false}
        lastSavedAt="2026-03-06T10:30:00.000Z"
        isUploadingPdf={false}
        pdf={{
          exportStatus: 'exported',
          webViewLink: 'https://drive.google.com/file',
          exportedAt: '2026-03-06T10:31:00.000Z',
        }}
        onUploadPdf={() => {}}
      />
    );

    expect(screen.getByText(/drive exportado/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Guardado$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('tooltip', { name: /^Guardado \d{2}:\d{2}$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abrir drive/i })).toHaveAttribute(
      'href',
      'https://drive.google.com/file'
    );
  });

  it('shows failed Drive state and delegates retry', () => {
    const onUploadPdf = vi.fn();

    render(
      <ClinicalDocumentStatusBar
        {...defaultStatusProps}
        isSaving={false}
        isUploadingPdf={false}
        pdf={{
          exportStatus: 'failed',
          exportError: 'drive down',
        }}
        onUploadPdf={onUploadPdf}
      />
    );

    expect(screen.getByText(/drive falló/i)).toBeInTheDocument();
    expect(screen.getByText(/drive down/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reintentar drive/i }));
    expect(onUploadPdf).toHaveBeenCalledTimes(1);
  });
});
