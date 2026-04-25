import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ClinicalDocumentStatusBar } from '@/features/clinical-documents/components/ClinicalDocumentStatusBar';

describe('ClinicalDocumentStatusBar', () => {
  it('shows an exported Drive state with a direct link', () => {
    render(
      <ClinicalDocumentStatusBar
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
