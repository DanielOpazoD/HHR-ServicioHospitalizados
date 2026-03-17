import React from 'react';
import { Pencil } from 'lucide-react';
import { hasTransferDocumentConfig } from '@/constants/hospitalConfigs';
import type { TransferRequest, TransferStatus } from '@/types/transfers';
import type { UserRole } from '@/types/auth';
import { TransferStatusInteraction } from './TransferStatusInteraction';
import { TransferTableRowActions } from './TransferTableRowActions';
import {
  getTransferRowActionState,
  getTransferTableDateLabel,
  isTransferActiveStatus,
  type TransferTableMode,
} from '../controllers/transferTableController';

interface TransferTableRowProps {
  transfer: TransferRequest;
  mode: TransferTableMode;
  role?: UserRole;
  onEdit: (transfer: TransferRequest) => void;
  onQuickStatusChange: (transfer: TransferRequest, newStatus: TransferStatus) => Promise<void>;
  onDeleteHistoryEntry: (transfer: TransferRequest, historyIndex: number) => Promise<void>;
  onGenerateDocs: (transfer: TransferRequest) => void;
  onViewDocs: (transfer: TransferRequest) => void;
  onUndo: (transfer: TransferRequest) => void;
  onArchive: (transfer: TransferRequest) => void;
  onOpenCloseMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export const TransferTableRow: React.FC<TransferTableRowProps> = ({
  transfer,
  mode,
  role,
  onEdit,
  onQuickStatusChange,
  onDeleteHistoryEntry,
  onGenerateDocs,
  onViewDocs,
  onUndo,
  onArchive,
  onOpenCloseMenu,
}) => {
  const hasDocumentSupport = hasTransferDocumentConfig(transfer.destinationHospital);
  const isActiveRow = isTransferActiveStatus(transfer.status);
  const actionState = getTransferRowActionState(transfer, mode, hasDocumentSupport, role);

  return (
    <tr className={`hover:bg-gray-50 ${!isActiveRow ? 'opacity-60' : ''}`}>
      <td className="px-4 py-3 align-top">
        <TransferStatusInteraction
          transfer={transfer}
          onStatusChange={status => onQuickStatusChange(transfer, status)}
          onDeleteHistoryEntry={idx => onDeleteHistoryEntry(transfer, idx)}
        />
      </td>
      <td className="px-4 py-3 align-top text-sm font-medium text-gray-900 whitespace-normal break-words">
        {transfer.bedId.replace('BED_', '')}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="text-sm font-medium leading-snug text-gray-900 whitespace-normal break-words">
          {transfer.patientSnapshot.name}
        </div>
        <div className="text-xs text-gray-500 whitespace-normal break-words">
          ({transfer.patientSnapshot.rut})
        </div>
      </td>
      <td className="px-4 py-3 align-top text-sm text-gray-500 whitespace-normal break-words leading-snug">
        {transfer.patientSnapshot.diagnosis}
      </td>
      <td className="px-4 py-3 align-top text-sm text-gray-500">
        <div className="whitespace-normal break-words leading-snug">
          {transfer.destinationHospital}
        </div>
        {actionState.canEditInline && (
          <button
            onClick={() => onEdit(transfer)}
            className="mt-0.5 block text-[10px] font-medium text-blue-600 underline hover:text-blue-800"
          >
            Editar
          </button>
        )}
      </td>
      <td className="px-4 py-3 align-top text-sm text-gray-500 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <span>{getTransferTableDateLabel(transfer.requestDate)}</span>
          {actionState.canEditInline && (
            <button
              type="button"
              onClick={() => onEdit(transfer)}
              className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              title="Modificar fecha de solicitud"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-3 align-top text-sm">
        <TransferTableRowActions
          transfer={transfer}
          actionState={actionState}
          hasDocumentSupport={hasDocumentSupport}
          onGenerateDocs={onGenerateDocs}
          onViewDocs={onViewDocs}
          onUndo={onUndo}
          onArchive={onArchive}
          onOpenCloseMenu={onOpenCloseMenu}
        />
      </td>
    </tr>
  );
};
