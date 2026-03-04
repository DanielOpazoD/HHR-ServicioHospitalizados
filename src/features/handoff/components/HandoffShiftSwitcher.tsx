import React from 'react';
import clsx from 'clsx';

interface HandoffShiftSwitcherProps {
  selectedShift: 'day' | 'night';
  setSelectedShift: (shift: 'day' | 'night') => void;
}

export const HandoffShiftSwitcher: React.FC<HandoffShiftSwitcherProps> = ({
  selectedShift,
  setSelectedShift,
}) => (
  <div className="flex bg-slate-100 p-1 rounded-lg">
    <button
      onClick={() => setSelectedShift('day')}
      className={clsx(
        'p-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer',
        selectedShift === 'day'
          ? 'bg-white text-teal-700 shadow-sm'
          : 'text-slate-500 hover:text-slate-700'
      )}
      aria-pressed={selectedShift === 'day'}
    >
      Turno Largo
    </button>
    <button
      onClick={() => setSelectedShift('night')}
      className={clsx(
        'p-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer',
        selectedShift === 'night'
          ? 'bg-white text-indigo-700 shadow-sm'
          : 'text-slate-500 hover:text-slate-700'
      )}
      aria-pressed={selectedShift === 'night'}
    >
      Turno Noche
    </button>
  </div>
);
