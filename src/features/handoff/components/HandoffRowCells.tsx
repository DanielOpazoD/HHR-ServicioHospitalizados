import React from 'react';
import type { PatientData } from '@/domain/handoff/patientContracts';
import { Clock } from 'lucide-react';
import { DebouncedTextarea } from '@/components/ui/DebouncedTextarea';
export { HandoffPatientCell } from './HandoffPatientCell';
export { HandoffDevicesCell } from './HandoffDevicesCell';
export { HandoffDiagnosisCell } from './HandoffDiagnosisCell';

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

interface HandoffObservationsCellProps {
  noteValue: string;
  onNoteChange: (val: string) => void;
  isFieldReadOnly: boolean;
}

export const HandoffObservationsCell: React.FC<HandoffObservationsCellProps> = ({
  noteValue,
  onNoteChange,
  isFieldReadOnly,
}) => (
  <td className="p-2 w-full min-w-[300px] align-top print:w-auto print:min-w-0 print:text-[8px] print:p-0.5">
    {isFieldReadOnly ? (
      <div className="whitespace-pre-wrap break-words text-sm text-slate-800 p-2 min-h-[50px] print:min-h-0 print:p-0 print:text-[8px] print:leading-tight">
        {noteValue || <span className="text-slate-400 italic">Sin observaciones</span>}
      </div>
    ) : (
      <>
        <div className="print:hidden">
          <DebouncedTextarea
            value={noteValue}
            onChangeValue={onNoteChange}
            className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-medical-500 focus:outline-none bg-white"
            minRows={2}
            debounceMs={1500}
          />
        </div>
        <div className="hidden print:block w-full whitespace-pre-wrap break-words text-slate-800 print:text-[8px] print:leading-tight">
          {noteValue}
        </div>
      </>
    )}
  </td>
);
