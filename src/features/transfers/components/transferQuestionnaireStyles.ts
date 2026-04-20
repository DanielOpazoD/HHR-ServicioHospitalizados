export const buildTransferQuestionnaireMetaInputClassName = (density: 'default' | 'compact') =>
  [
    'w-full rounded-lg border border-slate-200 bg-white font-medium',
    'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none',
    density === 'compact' ? 'px-3 py-1.5 text-[11px]' : 'px-3 py-2 text-xs',
  ].join(' ');
