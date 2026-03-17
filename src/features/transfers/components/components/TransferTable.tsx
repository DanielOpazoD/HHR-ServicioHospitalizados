/**
 * Transfer Table Component
 * Displays list of transfer requests with actions
 */

import React, { useEffect, useState } from 'react';
import type { TransferRequest, TransferStatus } from '@/types/transfers';
import { TransferTableCloseActionsMenu } from './TransferTableCloseActionsMenu';
import { TransferTableRow } from './TransferTableRow';
import type { TransferTableMode } from '../controllers/transferTableController';
import { getTransferRowActionState } from '../controllers/transferTableController';
import { useAuth } from '@/context/AuthContext';

interface TransferTableProps {
  transfers: TransferRequest[];
  mode?: TransferTableMode;
  emptyMessage?: string;
  onEdit: (transfer: TransferRequest) => void;
  onStatusChange: (transfer: TransferRequest) => void;
  onQuickStatusChange: (transfer: TransferRequest, newStatus: TransferStatus) => Promise<void>;
  onMarkTransferred: (transfer: TransferRequest) => void;
  onCancel: (transfer: TransferRequest) => void;
  onGenerateDocs: (transfer: TransferRequest) => void;
  onViewDocs: (transfer: TransferRequest) => void;
  onUndo: (transfer: TransferRequest) => void;
  onArchive: (transfer: TransferRequest) => void;
  onDelete: (transfer: TransferRequest) => Promise<void>;
  onDeleteHistoryEntry: (transfer: TransferRequest, historyIndex: number) => Promise<void>;
}

interface TransferActionsMenuState {
  transfer: TransferRequest;
  top: number;
  left: number;
}

const TABLE_COLUMNS = [
  { key: 'status', label: 'Estado', className: 'w-[10%]' },
  { key: 'bed', label: 'Cama', className: 'w-[6%]' },
  { key: 'patient', label: 'Paciente (RUT)', className: 'w-[16%]' },
  { key: 'diagnosis', label: 'Diagnóstico', className: 'w-[17%]' },
  { key: 'destination', label: 'Hospital Destino', className: 'w-[24%]' },
  { key: 'requestDate', label: 'Fecha Solicitud', className: 'w-[10%]' },
  { key: 'actions', label: 'Acciones', className: 'w-[17%]' },
] as const;

export const TransferTable: React.FC<TransferTableProps> = ({
  transfers,
  mode = 'active',
  emptyMessage = 'No hay solicitudes de traslado para este período',
  onEdit,
  onStatusChange: _onStatusChange,
  onQuickStatusChange,
  onMarkTransferred: _onMarkTransferred,
  onCancel,
  onGenerateDocs,
  onViewDocs,
  onUndo,
  onArchive,
  onDelete,
  onDeleteHistoryEntry,
}) => {
  const { role } = useAuth();
  const [openActionsMenu, setOpenActionsMenu] = useState<TransferActionsMenuState | null>(null);
  const [pendingDeleteTransfer, setPendingDeleteTransfer] = useState<TransferRequest | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-transfer-actions-root="true"]')) {
        setOpenActionsMenu(null);
      }
    };
    const closeMenu = () => setOpenActionsMenu(null);

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, []);

  const handleDeleteTransfer = async (transfer: TransferRequest) => {
    await onDelete(transfer);
    setPendingDeleteTransfer(null);
    setOpenActionsMenu(null);
  };

  const handleOpenActionsMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    transfer: TransferRequest
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 280;
    const targetLeft = Math.max(
      12,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12)
    );
    const isSame = openActionsMenu?.transfer.id === transfer.id;

    setOpenActionsMenu(
      isSame
        ? null
        : {
            transfer,
            top: rect.bottom + 8,
            left: targetLeft,
          }
    );
  };

  if (transfers.length === 0) {
    return <div className="py-12 text-center text-gray-500">{emptyMessage}</div>;
  }

  const openMenuActionState = openActionsMenu
    ? getTransferRowActionState(openActionsMenu.transfer, mode, true, role)
    : null;

  return (
    <div className="overflow-x-visible overflow-y-visible rounded-lg bg-white shadow">
      <table className="w-full table-fixed divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {TABLE_COLUMNS.map(column => (
              <th
                key={column.key}
                className={`${column.className} px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 whitespace-normal break-words`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {transfers.map(transfer => (
            <TransferTableRow
              key={transfer.id}
              transfer={transfer}
              mode={mode}
              role={role}
              onEdit={onEdit}
              onQuickStatusChange={onQuickStatusChange}
              onDeleteHistoryEntry={onDeleteHistoryEntry}
              onGenerateDocs={onGenerateDocs}
              onViewDocs={onViewDocs}
              onUndo={onUndo}
              onArchive={onArchive}
              onOpenCloseMenu={event => handleOpenActionsMenu(event, transfer)}
            />
          ))}
        </tbody>
      </table>
      {openActionsMenu && openMenuActionState && (
        <TransferTableCloseActionsMenu
          transfer={openActionsMenu.transfer}
          canCancelTransfer={openMenuActionState.canCancelTransfer}
          style={{ top: openActionsMenu.top, left: openActionsMenu.left }}
          onCancel={onCancel}
          onRequestDelete={setPendingDeleteTransfer}
          onClose={() => setOpenActionsMenu(null)}
        />
      )}
      {pendingDeleteTransfer && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Eliminar solicitud</h3>
            <p className="mt-2 text-sm text-slate-600">
              ¿Eliminar definitivamente la solicitud de{' '}
              <span className="font-semibold text-slate-800">
                {pendingDeleteTransfer.patientSnapshot.name}
              </span>
              ? Esta acción no se puede deshacer.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingDeleteTransfer(null)}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  void handleDeleteTransfer(pendingDeleteTransfer);
                }}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
