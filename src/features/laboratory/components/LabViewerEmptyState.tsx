/**
 * @module LabViewerEmptyState
 * @description Placeholder shown before any lab search has been performed.
 */

import React from 'react';
import { FlaskConical } from 'lucide-react';

export const LabViewerEmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
      <FlaskConical size={26} />
    </span>
    <p className="text-[13px] font-medium text-slate-400">Selecciona un paciente y busca</p>
    <p className="mt-0.5 text-[11px] text-slate-300">
      Los examenes de laboratorio Syslab se mostraran aqui
    </p>
  </div>
);
