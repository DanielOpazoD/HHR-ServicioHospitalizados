import clsx from 'clsx';
import { sizeClasses, type ModalSize } from '@/components/shared/baseModalStyles';

export const shouldCloseBaseModalFromBackdropClick = ({
  closeOnBackdrop,
  target,
  currentTarget,
}: {
  closeOnBackdrop: boolean;
  target: EventTarget | null;
  currentTarget: EventTarget | null;
}): boolean => closeOnBackdrop && target === currentTarget;

export const resolveBaseModalContainerClassName = ({
  scrollableBody,
  variant,
  size,
  className,
}: {
  scrollableBody: boolean;
  variant: 'glass' | 'white';
  size: ModalSize;
  className?: string;
}): string =>
  clsx(
    'rounded-2xl shadow-2xl w-full animate-scale-in overflow-hidden',
    !scrollableBody && 'mx-auto my-4',
    variant === 'white' ? 'bg-white border border-slate-200' : 'glass border border-white/40',
    sizeClasses[size],
    className
  );
