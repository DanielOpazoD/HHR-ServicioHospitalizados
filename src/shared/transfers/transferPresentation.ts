import { TRANSFER_STATUS_CONFIG, type TransferStatus } from '@/types/transfers';

const TRANSFER_STATUS_FALLBACK = {
  label: 'Desconocido',
  color: 'text-slate-700',
  bgColor: 'bg-slate-100',
};

export const formatTransferDate = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('es-CL');
};

export const formatTransferDateTime = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

export const formatTransferVerboseDateTime = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

export const getTransferStatusPresentation = (status: TransferStatus) =>
  TRANSFER_STATUS_CONFIG[status] || TRANSFER_STATUS_FALLBACK;

export const getTransferStatusLabel = (status: TransferStatus): string =>
  getTransferStatusPresentation(status).label;
