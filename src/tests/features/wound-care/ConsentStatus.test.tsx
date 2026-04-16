import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsentStatus } from '@/features/wound-care/components/ConsentStatus';
import type { WoundCareConsent, WoundCareAuditActor } from '@/types/domain/woundCare';

// ============================================================================
// Helpers
// ============================================================================

const mockActor: WoundCareAuditActor = {
  uid: 'u1',
  email: 'e@e.cl',
  displayName: 'Test',
  role: 'editor',
};

const makeConsent = (status: 'pending' | 'signed' | 'revoked'): WoundCareConsent => ({
  id: 'c1',
  patientRut: '1-1',
  patientName: 'P',
  episodeKey: 'ep',
  status,
  consentFileStoragePath: 'p',
  consentFileDownloadUrl: 'u',
  consentFileMimeType: 'application/pdf',
  consentFileSize: 100,
  signedAt: '2026-01-01T00:00:00Z',
  uploadedAt: '2026-01-01T00:00:00Z',
  uploadedBy: mockActor,
  ...(status === 'revoked'
    ? {
        revokedAt: '2026-01-02T00:00:00Z',
        revokedBy: mockActor,
        revocationReason: 'Revocado por paciente',
      }
    : {}),
});

// ============================================================================
// Tests
// ============================================================================

describe('ConsentStatus', () => {
  it('shows "Sin consentimiento" when consent is null', () => {
    const onAction = vi.fn();
    render(<ConsentStatus consent={null} onAction={onAction} />);

    expect(screen.getByText('Sin consentimiento')).toBeInTheDocument();
  });

  it('shows "Consentimiento firmado" when consent status is signed', () => {
    const onAction = vi.fn();
    render(<ConsentStatus consent={makeConsent('signed')} onAction={onAction} />);

    expect(screen.getByText('Consentimiento firmado')).toBeInTheDocument();
  });

  it('shows "Consentimiento revocado" when consent status is revoked', () => {
    const onAction = vi.fn();
    render(<ConsentStatus consent={makeConsent('revoked')} onAction={onAction} />);

    expect(screen.getByText('Consentimiento revocado')).toBeInTheDocument();
  });

  it('calls onAction when clicked', () => {
    const onAction = vi.fn();
    render(<ConsentStatus consent={null} onAction={onAction} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(onAction).toHaveBeenCalledOnce();
  });

  it('is not clickable when readOnly and signed', () => {
    const onAction = vi.fn();
    render(<ConsentStatus consent={makeConsent('signed')} onAction={onAction} readOnly={true} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();

    // Click on disabled button should not fire onAction
    fireEvent.click(button);
    expect(onAction).not.toHaveBeenCalled();
  });
});
