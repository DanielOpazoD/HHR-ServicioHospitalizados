import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpcChecklistPanel } from '@/features/census/components/patient-row/UpcChecklistPanel';

const defaults = {
  draftUci: new Set<string>(),
  draftUti: new Set<string>(),
  draftClassification: null as 'UPC_UCI' | 'UPC_UTI' | null,
  hasDraftCriteria: false,
  uciAllowed: true,
  onToggleUci: vi.fn(),
  onToggleUti: vi.fn(),
  onSave: vi.fn(),
  onClear: vi.fn(),
  onClose: vi.fn(),
};

describe('UpcChecklistPanel', () => {
  it('renders UCI and UTI section headers', () => {
    render(<UpcChecklistPanel {...defaults} />);
    expect(screen.getByText(/UCI — Soporte vital avanzado/)).toBeTruthy();
    expect(screen.getByText(/UTI — Monitorización y soporte no invasivo/)).toBeTruthy();
  });

  it('renders 3 UCI checkboxes and 11 UTI checkboxes', () => {
    render(<UpcChecklistPanel {...defaults} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(14); // 3 + 11
  });

  it('shows "No UPC" badge when no criteria selected', () => {
    render(<UpcChecklistPanel {...defaults} />);
    expect(screen.getByText('No UPC')).toBeTruthy();
  });

  it('shows "UCI" badge when classification is UPC_UCI', () => {
    render(
      <UpcChecklistPanel
        {...defaults}
        draftUci={new Set(['uci_vmi'])}
        draftClassification="UPC_UCI"
        hasDraftCriteria={true}
      />
    );
    expect(screen.getByText('UCI')).toBeTruthy();
  });

  it('shows "UTI" badge when classification is UPC_UTI', () => {
    render(
      <UpcChecklistPanel
        {...defaults}
        draftUti={new Set(['uti_sepsis'])}
        draftClassification="UPC_UTI"
        hasDraftCriteria={true}
      />
    );
    expect(screen.getByText('UTI')).toBeTruthy();
  });

  it('shows criteria count when criteria are selected', () => {
    render(
      <UpcChecklistPanel
        {...defaults}
        draftUti={new Set(['uti_sepsis', 'uti_hemorragia'])}
        hasDraftCriteria={true}
      />
    );
    expect(screen.getByText('2 criterios')).toBeTruthy();
  });

  it('shows singular "criterio" for single selection', () => {
    render(
      <UpcChecklistPanel {...defaults} draftUci={new Set(['uci_vmi'])} hasDraftCriteria={true} />
    );
    expect(screen.getByText('1 criterio')).toBeTruthy();
  });

  it('disables UCI checkboxes when uciAllowed is false', () => {
    render(<UpcChecklistPanel {...defaults} uciAllowed={false} />);
    expect(screen.getByText('(no disponible en Neo)')).toBeTruthy();

    const checkboxes = screen.getAllByRole('checkbox');
    // First 3 are UCI — should be disabled
    expect(checkboxes[0]).toHaveProperty('disabled', true);
    expect(checkboxes[1]).toHaveProperty('disabled', true);
    expect(checkboxes[2]).toHaveProperty('disabled', true);
    // UTI checkboxes should be enabled
    expect(checkboxes[3]).toHaveProperty('disabled', false);
  });

  it('calls onToggleUci when UCI checkbox clicked', () => {
    const onToggleUci = vi.fn();
    render(<UpcChecklistPanel {...defaults} onToggleUci={onToggleUci} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // first UCI checkbox
    expect(onToggleUci).toHaveBeenCalledWith('uci_vmi');
  });

  it('calls onToggleUti when UTI checkbox clicked', () => {
    const onToggleUti = vi.fn();
    render(<UpcChecklistPanel {...defaults} onToggleUti={onToggleUti} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[3]); // first UTI checkbox
    expect(onToggleUti).toHaveBeenCalledWith('uti_mon_cardiaca');
  });

  it('calls onSave when Guardar clicked', () => {
    const onSave = vi.fn();
    render(<UpcChecklistPanel {...defaults} onSave={onSave} />);
    fireEvent.click(screen.getByText('Guardar'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('shows Limpiar button only when criteria are selected', () => {
    const { rerender } = render(<UpcChecklistPanel {...defaults} />);
    expect(screen.queryByText('Limpiar')).toBeNull();

    rerender(<UpcChecklistPanel {...defaults} hasDraftCriteria={true} />);
    expect(screen.getByText('Limpiar')).toBeTruthy();
  });

  it('calls onClose when X button clicked', () => {
    const onClose = vi.fn();
    render(<UpcChecklistPanel {...defaults} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Cerrar checklist UPC'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has role="dialog" and aria-label', () => {
    render(<UpcChecklistPanel {...defaults} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-label')).toBe('Checklist de clasificación UPC');
  });

  it('has aria-live on classification badge', () => {
    render(<UpcChecklistPanel {...defaults} />);
    const badge = screen.getByText('No UPC');
    expect(badge.getAttribute('aria-live')).toBe('polite');
  });
});
