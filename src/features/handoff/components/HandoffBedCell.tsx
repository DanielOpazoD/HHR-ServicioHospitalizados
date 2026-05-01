import React from 'react';
import { Clock } from 'lucide-react';

interface HandoffBedCellProps {
  bedName: string;
  isSubRow: boolean;
  daysHospitalized: number | null;
}

export const HandoffBedCell: React.FC<HandoffBedCellProps> = ({
  bedName,
  isSubRow,
  daysHospitalized,
}) => (
  <td className="p-2 border-r border-slate-200/60 text-center w-20 align-middle print:w-auto print:text-[10px] print:p-1">
    <div className="font-bold text-slate-700 text-base print:text-[10px] flex flex-col items-center">
      <span>{!isSubRow && bedName}</span>
      {!isSubRow && daysHospitalized !== null && (
        <span className="hidden print:inline font-normal text-[9px] text-slate-500 leading-none mt-0.5">
          ({daysHospitalized}d)
        </span>
      )}
    </div>
    {!isSubRow && daysHospitalized !== null && (
      <div
        className="flex flex-col items-center justify-center mt-1 text-slate-500 print:hidden"
        title="Días Hospitalizado"
      >
        <Clock size={12} className="print:hidden" />
        <span className="text-[10px] font-bold">{daysHospitalized}d</span>
      </div>
    )}
  </td>
);
