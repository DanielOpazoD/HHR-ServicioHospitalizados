import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Printer, ChevronDown } from 'lucide-react';
import type { MedicalPrintMode } from '@/features/handoff/controllers/medicalHandoffTabsController';

interface MedicalHandoffPrintMenuProps {
  upcPatientCount: number;
  nonUpcPatientCount: number;
  onPrint: (mode: MedicalPrintMode) => void;
}

export const MedicalHandoffPrintMenu: React.FC<MedicalHandoffPrintMenuProps> = ({
  upcPatientCount,
  nonUpcPatientCount,
  onPrint,
}) => {
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const printMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (printMenuRef.current && !printMenuRef.current.contains(e.target as Node)) {
        setShowPrintMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={printMenuRef}>
      <button
        onClick={() => setShowPrintMenu(!showPrintMenu)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
      >
        <Printer size={16} />
        Imprimir
        <ChevronDown
          size={14}
          className={clsx('transition-transform', showPrintMenu && 'rotate-180')}
        />
      </button>

      {showPrintMenu && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 min-w-[180px]">
          <button
            onClick={() => {
              onPrint('all');
              setShowPrintMenu(false);
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
          >
            📋 Todos los pacientes
          </button>
          <button
            onClick={() => {
              onPrint('upc');
              setShowPrintMenu(false);
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-700 flex items-center gap-2"
          >
            🔴 Solo UPC ({upcPatientCount})
          </button>
          <button
            onClick={() => {
              onPrint('no-upc');
              setShowPrintMenu(false);
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-green-50 text-green-700 flex items-center gap-2"
          >
            🟢 Solo No UPC ({nonUpcPatientCount})
          </button>
        </div>
      )}
    </div>
  );
};
