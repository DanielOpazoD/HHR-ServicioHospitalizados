import type { ClinicalDocumentStatus } from '@/features/clinical-documents/domain/entities';

export const formatClinicalDocumentDateTime = (isoString?: string): string => {
  if (!isoString) return '—';
  const value = new Date(isoString);
  return Number.isNaN(value.getTime())
    ? isoString
    : value.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

export const formatClinicalDocumentDate = (value?: string): string => {
  if (!value) return 'Sin fecha';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}-${month}-${year}`;
};

export const getClinicalDocumentStatusLabel = (status: ClinicalDocumentStatus): string => {
  switch (status) {
    case 'ready_for_signature':
      return 'Lista';
    case 'signed':
      return 'Firmada';
    case 'archived':
      return 'Archivada';
    default:
      return 'Borrador';
  }
};

export const getClinicalDocumentStatusClassName = (status: ClinicalDocumentStatus): string => {
  switch (status) {
    case 'signed':
      return 'bg-emerald-100 text-emerald-700';
    case 'ready_for_signature':
      return 'bg-amber-100 text-amber-700';
    case 'archived':
      return 'bg-slate-200 text-slate-600';
    default:
      return 'bg-slate-100 text-slate-600';
  }
};
