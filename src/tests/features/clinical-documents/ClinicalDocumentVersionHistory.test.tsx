import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ClinicalDocumentVersionHistory } from '@/features/clinical-documents/components/ClinicalDocumentVersionHistory';
import type { ClinicalDocumentVersionMeta } from '@/features/clinical-documents/domain/entities';

const actor = {
  uid: 'u1',
  email: 'doc@test.cl',
  displayName: 'Doctor Test',
  role: 'doctor_urgency',
};

const makeVersion = (
  version: number,
  reason: ClinicalDocumentVersionMeta['reason'],
  savedAt = '2026-04-17T08:30:00.000Z'
): ClinicalDocumentVersionMeta => ({ version, savedAt, savedBy: actor, reason });

describe('ClinicalDocumentVersionHistory', () => {
  it('renders an empty-state when no versions are provided', () => {
    render(<ClinicalDocumentVersionHistory versions={[]} currentVersion={1} onClose={vi.fn()} />);

    expect(screen.getByText('Sin historial de versiones')).toBeInTheDocument();
    expect(screen.getByText(/Historial de versiones/)).toBeInTheDocument();
  });

  it('renders versions sorted descending and marks the current one', () => {
    const versions = [
      makeVersion(1, 'manual'),
      makeVersion(3, 'signature'),
      makeVersion(2, 'autosave'),
    ];

    render(
      <ClinicalDocumentVersionHistory versions={versions} currentVersion={2} onClose={vi.fn()} />
    );

    const versionMarks = Array.from(document.body.querySelectorAll('span.font-mono')).map(
      n => n.textContent
    );
    expect(versionMarks).toEqual(['v3', 'v2', 'v1']);

    expect(screen.getByText('Firmado')).toBeInTheDocument();
    expect(screen.getByText('Autoguardado')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it('formats savedAt as DD/MM/YYYY HH:mm and falls back to raw string when invalid', () => {
    const versions = [
      makeVersion(1, 'manual', '2026-04-17T08:30:00.000Z'),
      makeVersion(2, 'autosave', 'not-a-date'),
    ];

    render(
      <ClinicalDocumentVersionHistory versions={versions} currentVersion={2} onClose={vi.fn()} />
    );

    expect(screen.getByText(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/)).toBeInTheDocument();
    expect(screen.getByText('not-a-date')).toBeInTheDocument();
  });

  it('uses the default config for an unknown reason label and icon', () => {
    const versions = [
      {
        version: 1,
        savedAt: '2026-04-17T08:30:00.000Z',
        savedBy: actor,
        reason: 'some-future-reason' as unknown as ClinicalDocumentVersionMeta['reason'],
      },
    ];

    render(
      <ClinicalDocumentVersionHistory versions={versions} currentVersion={1} onClose={vi.fn()} />
    );

    expect(screen.getByText('some-future-reason')).toBeInTheDocument();
  });

  it('invokes onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <ClinicalDocumentVersionHistory
        versions={[makeVersion(1, 'manual')]}
        currentVersion={1}
        onClose={onClose}
      />
    );

    const closeButton = document.body.querySelector('button[type="button"]');
    fireEvent.click(closeButton as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <ClinicalDocumentVersionHistory
        versions={[makeVersion(1, 'manual')]}
        currentVersion={1}
        onClose={onClose}
      />
    );

    const backdrop = document.body.querySelector('div.fixed.inset-0.bg-black\\/20');
    fireEvent.click(backdrop as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose when Escape is pressed and detaches the listener on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <ClinicalDocumentVersionHistory
        versions={[makeVersion(1, 'manual')]}
        currentVersion={1}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores non-Escape keys', () => {
    const onClose = vi.fn();
    render(
      <ClinicalDocumentVersionHistory
        versions={[makeVersion(1, 'manual')]}
        currentVersion={1}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
