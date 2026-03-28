import React from 'react';
import { BedDefinition } from '@/types/domain/beds';
import { Plus } from 'lucide-react';
import { MedicalBadge } from '@/components/ui/base/MedicalBadge';
import type { TableColumnConfig } from '@/context/TableConfigContext';

interface EmptyBedRowProps {
  bed: BedDefinition;
  columns: TableColumnConfig;
  visibleColumnCount: number;
  onClick: () => void;
  readOnly?: boolean;
}

export const EmptyBedRow: React.FC<EmptyBedRowProps> = ({
  bed,
  columns,
  visibleColumnCount,
  onClick,
  readOnly = false,
}) => {
  const totalWidth = Object.values(columns).reduce((sum, width) => sum + width, 0);
  const fixedColumnsWidth = columns.actions + columns.bed + columns.type;
  const remainingWidth = totalWidth - fixedColumnsWidth;

  return (
    <tr
      className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer group"
      onClick={!readOnly ? onClick : undefined}
    >
      <td
        style={{ width: columns.actions }}
        className="p-1 border-r border-slate-100 print:hidden"
      />

      <td style={{ width: columns.bed }} className="p-1 border-r border-slate-100 text-center">
        <span className="text-slate-400 font-medium text-xs">{bed.name}</span>
      </td>

      <td style={{ width: columns.type }} className="p-1 border-r border-slate-100 text-center">
        <MedicalBadge variant={bed.type === 'UTI' ? 'red' : 'slate'} className="opacity-50">
          {bed.type}
        </MedicalBadge>
      </td>

      <td
        colSpan={Math.max(1, visibleColumnCount - 3)}
        style={{ width: remainingWidth }}
        className="p-1 pl-3"
      >
        {!readOnly && (
          <button
            className="flex items-center gap-1.5 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 bg-slate-50 hover:bg-medical-100 border border-transparent group-hover:border-slate-200 text-slate-400 hover:text-medical-600 text-xs transition-all duration-200"
            onClick={event => {
              event.stopPropagation();
              onClick();
            }}
          >
            <Plus size={14} className="transition-transform group-hover:scale-110" />
            <span className="font-medium">Agregar paciente</span>
          </button>
        )}
      </td>
    </tr>
  );
};
