export const TRANSFER_FORM_FIELD_CLASSNAME =
  'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium';

export const TRANSFER_FORM_FIELD_BASE_CLASSNAME =
  'px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium';

export const TRANSFER_FORM_FIELD_NESTED_CLASSNAME =
  'mt-2 w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium';

export const TRANSFER_FORM_TEXTAREA_CLASSNAME =
  'w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none';

type TransferPatientSummaryVariant = 'selected' | 'existing';

const TRANSFER_PATIENT_SUMMARY_VARIANTS: Record<
  TransferPatientSummaryVariant,
  {
    card: string;
    title: string;
    body: string;
  }
> = {
  selected: {
    card: 'p-2.5 bg-blue-50 border border-blue-100 rounded-xl animate-fade-in',
    title: 'text-[11px] font-black text-blue-700 uppercase tracking-widest leading-none mb-1',
    body: 'text-sm text-slate-500 font-medium leading-snug',
  },
  existing: {
    card: 'p-2.5 bg-slate-50 rounded-xl border border-slate-100',
    title: 'text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5',
    body: 'text-sm text-slate-500 font-medium leading-snug',
  },
};

export const buildTransferPatientSummaryClassName = (variant: TransferPatientSummaryVariant) =>
  TRANSFER_PATIENT_SUMMARY_VARIANTS[variant];
