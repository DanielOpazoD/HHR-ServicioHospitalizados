export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '5xl' | 'full';

export const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '5xl': 'max-w-5xl',
  full: 'max-w-[95vw]',
};

export type ModalSectionVariant = 'default' | 'success' | 'warning' | 'info' | 'danger';

export const modalSectionVariantClasses: Record<
  ModalSectionVariant,
  { border: string; title: string; desc: string }
> = {
  default: { border: 'border-white/60', title: 'text-slate-800', desc: 'text-slate-600/80' },
  success: { border: 'border-emerald-200', title: 'text-emerald-800', desc: 'text-emerald-600/80' },
  warning: { border: 'border-orange-200', title: 'text-orange-800', desc: 'text-orange-600/80' },
  info: { border: 'border-blue-200', title: 'text-blue-800', desc: 'text-blue-600/80' },
  danger: { border: 'border-red-200', title: 'text-red-800', desc: 'text-red-600/80' },
};
