import React from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface BaseModalBackdropProps {
  printable: boolean;
  scrollableBody: boolean;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}

export const BaseModalBackdrop: React.FC<BaseModalBackdropProps> = ({
  printable,
  scrollableBody,
  onClick,
  children,
}) => (
  <div
    className={clsx(
      'fixed inset-0 bg-slate-900/60 z-[100] backdrop-blur-sm animate-fade-in',
      scrollableBody ? 'flex items-center justify-center p-4' : 'overflow-y-auto p-4',
      !printable && 'print:hidden'
    )}
    style={{ isolation: 'isolate' }}
    onClick={onClick}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
  >
    {children}
  </div>
);

interface BaseModalHeaderProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  showCloseButton: boolean;
  headerIconColor: string;
  variant: 'glass' | 'white';
  headerActions?: React.ReactNode;
}

export const BaseModalHeader: React.FC<BaseModalHeaderProps> = ({
  title,
  icon,
  onClose,
  showCloseButton,
  headerIconColor,
  variant,
  headerActions,
}) => (
  <div
    className={clsx(
      'px-4 py-2 border-b flex justify-between items-center sticky top-0 z-10',
      variant === 'white' ? 'bg-white border-slate-100' : 'bg-white/30 border-white/20'
    )}
  >
    <h3
      id="modal-title"
      className="font-display font-bold text-slate-800 flex items-center gap-2 tracking-tight"
    >
      {icon && <span className={headerIconColor}>{icon}</span>}
      {title}
    </h3>
    <div className="flex items-center gap-2">
      {headerActions && <div className="flex items-center gap-1.6 mr-1">{headerActions}</div>}
      {showCloseButton && (
        <button
          onClick={onClose}
          className={clsx(
            'transition-colors p-1 rounded-full',
            variant === 'white'
              ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              : 'text-slate-400 hover:text-slate-600 bg-white/50'
          )}
          aria-label="Cerrar modal"
        >
          <X size={18} />
        </button>
      )}
    </div>
  </div>
);

interface BaseModalBodyProps {
  scrollableBody: boolean;
  bodyClassName?: string;
  children: React.ReactNode;
}

export const BaseModalBody: React.FC<BaseModalBodyProps> = ({
  scrollableBody,
  bodyClassName,
  children,
}) => (
  <div
    className={clsx(
      scrollableBody ? 'max-h-[70vh] overflow-y-auto' : 'overflow-visible',
      bodyClassName || 'p-6 space-y-6'
    )}
  >
    {children}
  </div>
);
