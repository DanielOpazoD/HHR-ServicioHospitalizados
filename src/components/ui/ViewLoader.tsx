/**
 * ViewLoader
 * Loading fallback component for lazy-loaded views.
 * Minimal spinner with subtle text.
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

export const ViewLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[300px] py-16 print:hidden">
    <div className="flex flex-col items-center gap-2.5">
      <Loader2 size={28} className="animate-spin text-accent-500" />
      <span className="text-slate-400 text-xs font-medium tracking-wide">Cargando...</span>
    </div>
  </div>
);
