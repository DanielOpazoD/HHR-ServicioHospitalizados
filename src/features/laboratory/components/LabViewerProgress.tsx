import React from 'react';
import type { ProgressState } from '../types/labViewerTypes';

interface LabViewerProgressProps {
  progress: ProgressState | null;
}

export const LabViewerProgress: React.FC<LabViewerProgressProps> = ({ progress }) =>
  progress ? (
    <div className="mb-4">
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-slate-200/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-[width] duration-500 ease-out"
          style={{ width: `${progress.pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-center text-[11px] text-slate-400">{progress.text}</p>
    </div>
  ) : null;
