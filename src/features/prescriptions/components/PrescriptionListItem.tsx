import React, { useEffect, useState } from 'react';
import { ImageOff, Loader2, Package, UserMinus } from 'lucide-react';
import {
  PRESCRIPTION_ASSIGNMENT_SCOPE_LABELS,
  PRESCRIPTION_TYPE_LABELS,
  resolvePrescriptionAssignmentScope,
  type PrescriptionRecord,
} from '@/types/prescriptionTypes';
import { resolvePrescriptionImageDownloadUrl } from '@/features/prescriptions/services/prescriptionStorageImageService';

interface PrescriptionListItemProps {
  record: PrescriptionRecord;
  onSelect: (record: PrescriptionRecord) => void;
}

const formatDateTime = (iso: string): string => {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const TYPE_BADGE_CLASS: Record<string, string> = {
  comun: 'border-slate-200 bg-slate-100 text-slate-700',
  psicotropicos: 'border-slate-200 bg-white text-slate-700',
  benzodiazepinas: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

const TYPE_BADGE_LABEL: Record<string, string> = {
  comun: 'Común',
  psicotropicos: 'Blanca',
  benzodiazepinas: 'Verde',
};

export const PrescriptionListItem: React.FC<PrescriptionListItemProps> = ({ record, onSelect }) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [thumbError, setThumbError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resolvePrescriptionImageDownloadUrl(record.image.thumbnailStoragePath)
      .then(url => {
        if (!cancelled) setThumbUrl(url);
      })
      .catch(() => {
        if (!cancelled) setThumbError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [record.image.thumbnailStoragePath]);

  const assignmentScope = resolvePrescriptionAssignmentScope(record);
  const isUnassigned = assignmentScope === 'unassigned';
  const isStock = assignmentScope === 'hospitalized_stock';
  const badgeClass =
    TYPE_BADGE_CLASS[record.prescriptionType] || 'border-slate-200 bg-slate-100 text-slate-700';

  return (
    <button
      type="button"
      onClick={() => onSelect(record)}
      data-testid={`prescription-row-${record.id}`}
      className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50"
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {thumbError ? (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <ImageOff size={20} />
          </div>
        ) : thumbUrl ? (
          <img
            src={thumbUrl}
            alt="Miniatura de la receta"
            className="block h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <Loader2 size={16} className="animate-spin" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span
            title={PRESCRIPTION_TYPE_LABELS[record.prescriptionType]}
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClass}`}
          >
            {TYPE_BADGE_LABEL[record.prescriptionType] || record.prescriptionType}
          </span>
          {isUnassigned && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              <UserMinus size={10} /> Sin paciente
            </span>
          )}
          {isStock && (
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800">
              <Package size={10} /> Stock
            </span>
          )}
        </div>

        <div className="text-sm font-semibold text-slate-800 truncate">
          {isStock
            ? PRESCRIPTION_ASSIGNMENT_SCOPE_LABELS.hospitalized_stock
            : isUnassigned
              ? 'Sin paciente asignado'
              : `${record.bedId ?? 'Cama —'} · ${record.patientName ?? 'Paciente sin nombre'}`}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>{formatDateTime(record.createdAt)}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">
            {record.uploader?.displayName ||
              record.uploader?.email ||
              (record.uploader?.source === 'qr_pin' ? 'Vía QR + PIN' : 'Personal autenticado')}
          </span>
        </div>
      </div>
    </button>
  );
};
