import React from 'react';
import clsx from 'clsx';
import type { MedicalTabMode } from '@/features/handoff/controllers/medicalHandoffTabsController';

interface MedicalHandoffTabSwitcherProps {
  activeTab: MedicalTabMode;
  setActiveTab: (tab: MedicalTabMode) => void;
  upcPatientCount: number;
  nonUpcPatientCount: number;
}

export const MedicalHandoffTabSwitcher: React.FC<MedicalHandoffTabSwitcherProps> = ({
  activeTab,
  setActiveTab,
  upcPatientCount,
  nonUpcPatientCount,
}) => (
  <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
    <button
      onClick={() => setActiveTab('all')}
      className={clsx(
        'px-4 py-2 rounded-md text-sm font-medium transition-colors',
        activeTab === 'all'
          ? 'bg-white text-slate-800 shadow-sm'
          : 'text-slate-500 hover:text-slate-700'
      )}
    >
      Todos ({upcPatientCount + nonUpcPatientCount})
    </button>
    <button
      onClick={() => setActiveTab('upc')}
      className={clsx(
        'px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2',
        activeTab === 'upc'
          ? 'bg-red-100 text-red-700 shadow-sm'
          : 'text-slate-500 hover:text-slate-700'
      )}
    >
      🔴 UPC ({upcPatientCount})
    </button>
    <button
      onClick={() => setActiveTab('no-upc')}
      className={clsx(
        'px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2',
        activeTab === 'no-upc'
          ? 'bg-green-100 text-green-700 shadow-sm'
          : 'text-slate-500 hover:text-slate-700'
      )}
    >
      🟢 No UPC ({nonUpcPatientCount})
    </button>
  </div>
);
