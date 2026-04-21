import React from 'react';
import { Trash2, XCircle } from 'lucide-react';
import type { TransferRequest } from '@/types/transfers';

interface TransferTableCloseActionsMenuProps {
  transfer: TransferRequest;
  canCancelTransfer: boolean;
  style: React.CSSProperties;
  onCancel: (transfer: TransferRequest) => void;
  onRequestDelete: (transfer: TransferRequest) => void;
  onClose: () => void;
}

export const TransferTableCloseActionsMenu: React.FC<TransferTableCloseActionsMenuProps> = ({
  transfer,
  canCancelTransfer,
  style,
  onCancel,
  onRequestDelete,
  onClose,
}) => (
  <div
    data-transfer-actions-root="true"
    className="fixed z-[9999] w-[280px] rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
    style={style}
  >
    <button
      onClick={() => {
        if (!canCancelTransfer) {
          return;
        }
        onCancel(transfer);
        onClose();
      }}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={!canCancelTransfer}
      title={
        canCancelTransfer
          ? 'Cancelar traslado con justificación'
          : 'Solo disponible para solicitudes activas'
      }
    >
      <XCircle size={14} />
      <span>
        Cancelar traslado{' '}
        <span className="text-[10px] font-normal text-slate-400">(Justificar)</span>
      </span>
    </button>
    <button
      onClick={() => {
        onRequestDelete(transfer);
        onClose();
      }}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-red-700 hover:bg-red-50"
    >
      <Trash2 size={14} />
      <span>
        Eliminar solicitud{' '}
        <span className="text-[10px] font-normal text-slate-400">(Error de generación)</span>
      </span>
    </button>
  </div>
);
