import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTH_NAMES } from '@/constants/export';
import { useDropdownMenu } from '@/hooks/useDropdownMenu';

interface DateStripMonthNavigatorProps {
  selectedMonth: number;
  onChangeMonth: (delta: number) => void;
  onSelectMonth?: (month: number) => void;
}

export const DateStripMonthNavigator: React.FC<DateStripMonthNavigatorProps> = ({
  selectedMonth,
  onChangeMonth,
  onSelectMonth,
}) => {
  const { isOpen, menuRef, toggle, close } = useDropdownMenu();
  const currentMonth = new Date().getMonth();

  return (
    <div
      className="relative flex items-center shrink-0 rounded-lg bg-slate-50 border border-slate-200/80 px-0.5 py-0.5"
      ref={menuRef}
    >
      <button
        onClick={() => onChangeMonth(-1)}
        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
      >
        <ChevronLeft size={13} />
      </button>
      <button
        onClick={toggle}
        className="mx-1 uppercase text-[12px] font-semibold text-slate-600 tracking-wide hover:text-slate-900 hover:bg-white rounded px-1 py-0.5 transition-colors min-w-[54px] text-center"
      >
        {MONTH_NAMES[selectedMonth]}
      </button>
      <button
        onClick={() => onChangeMonth(1)}
        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
      >
        <ChevronRight size={13} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-36 bg-white rounded-xl shadow-xl border border-slate-200 ring-1 ring-black/[0.04] z-50 overflow-hidden py-1 grid grid-cols-2 gap-0.5 px-1">
          {MONTH_NAMES.map((name, index) => (
            <button
              key={name}
              onClick={() => {
                if (onSelectMonth) {
                  onSelectMonth(index);
                } else {
                  onChangeMonth(index - selectedMonth);
                }
                close();
              }}
              className={`px-2 py-1.5 text-[11px] font-medium text-center rounded-lg transition-colors ${
                index === selectedMonth
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : index === currentMonth
                    ? 'text-slate-700 hover:bg-slate-50 font-semibold'
                    : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {name.substring(0, 3)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
