import React from 'react';
import { Printer } from 'lucide-react';
import type { ActionButtonsProps } from './types';

export const PdfButtons: React.FC<Pick<ActionButtonsProps, 'onExportPDF'>> = ({ onExportPDF }) => {
  if (!onExportPDF) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onExportPDF}
        className="btn btn-secondary h-[30px] bg-teal-600 text-white hover:bg-teal-700 border-none !px-2.5 !py-0 text-[10px] rounded-lg"
        title="Descargar PDF (rápido)"
      >
        <Printer size={13} />
        PDF
      </button>
    </div>
  );
};
