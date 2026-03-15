/**
 * Transfer Status Badge Component (Clickeable)
 * Visual indicator for transfer request status - clicking opens status change modal
 */

import React from 'react';
import { TransferStatus } from '@/types/transfers';
import { getTransferStatusPresentation } from '@/shared/transfers/transferPresentation';

interface TransferStatusBadgeProps {
  status: TransferStatus;
  onClick?: () => void;
  clickable?: boolean;
}

export const TransferStatusBadge: React.FC<TransferStatusBadgeProps> = ({
  status,
  onClick,
  clickable = false,
}) => {
  const config = getTransferStatusPresentation(status);

  if (clickable && onClick) {
    return (
      <button
        onClick={onClick}
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color} hover:ring-2 hover:ring-offset-1 hover:ring-blue-400 transition-all cursor-pointer`}
        title="Clic para cambiar estado"
      >
        {config.label}
        <span className="ml-1 opacity-60">▾</span>
      </button>
    );
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
    >
      {config.label}
    </span>
  );
};
