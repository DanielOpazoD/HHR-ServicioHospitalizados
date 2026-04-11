import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DischargeRow } from '@/features/census/components/DischargeRow';
import { DataFactory } from '@/tests/factories/DataFactory';

vi.mock('@/features/census/components/FugaNotificationModal', () => ({
  FugaNotificationModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? (
      <tr data-testid="fuga-modal">
        <td />
      </tr>
    ) : null,
}));

vi.mock('@/features/census/components/IEEHFormDialog', () => ({
  IEEHFormDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="ieeh-modal" /> : null,
}));

describe('DischargeRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders row data and dispatches actions', () => {
    const item = DataFactory.createMockDischarge({
      id: 'd1',
      patientName: 'Paciente Alta',
      status: 'Fallecido',
    });
    const onUndo = vi.fn().mockResolvedValue(undefined);
    const onEdit = vi.fn();
    const onUpdate = vi.fn();
    const onDelete = vi.fn().mockResolvedValue(undefined);

    render(
      <table>
        <tbody>
          <DischargeRow
            item={item}
            recordDate="2026-02-14"
            onUndo={onUndo}
            onEdit={onEdit}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        </tbody>
      </table>
    );

    expect(screen.getByText('Paciente Alta')).toBeInTheDocument();
    expect(screen.getByText('Fallecido')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Deshacer (Restaurar a Cama)'));
    fireEvent.click(screen.getByTitle('Editar'));
    fireEvent.click(screen.getByTitle('Eliminar Registro'));

    expect(onUndo).toHaveBeenCalledWith('d1');
    expect(onEdit).toHaveBeenCalledWith(item);
    expect(onDelete).toHaveBeenCalledWith('d1');
  });

  it('lazy-loads the fuga and IEEH modals only when opened', async () => {
    const item = DataFactory.createMockDischarge({
      id: 'd2',
      patientName: 'Paciente Fuga',
      dischargeType: 'Fuga',
      status: 'Vivo',
      originalData: DataFactory.createMockPatient('bed1', {
        patientName: 'Paciente Fuga',
      }),
    });
    const onUndo = vi.fn().mockResolvedValue(undefined);
    const onEdit = vi.fn();
    const onUpdate = vi.fn();
    const onDelete = vi.fn().mockResolvedValue(undefined);

    render(
      <table>
        <tbody>
          <DischargeRow
            item={item}
            recordDate="2026-02-14"
            onUndo={onUndo}
            onEdit={onEdit}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        </tbody>
      </table>
    );

    expect(screen.queryByTestId('fuga-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ieeh-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Notificar fuga por correo'));
    expect(await screen.findByTestId('fuga-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Generar Informe Estadístico de Egreso (IEEH)'));
    await waitFor(() => {
      expect(screen.getByTestId('ieeh-modal')).toBeInTheDocument();
    });
  });
});
