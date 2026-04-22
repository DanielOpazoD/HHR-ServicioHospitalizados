/**
 * BaseModal Component
 *
 * A reusable modal wrapper that provides consistent styling and behavior
 * across all modals in the application. Includes:
 * - Semi-transparent backdrop with blur effect
 * - Glass morphism container with animations
 * - Consistent header with title and close button
 * - Scrollable content area
 *
 * @example
 * ```tsx
 * <BaseModal
 *     isOpen={showSettings}
 *     onClose={() => setShowSettings(false)}
 *     title="Configuración"
 *     icon={<Settings size={18} />}
 * >
 *     <ModalContent />
 * </BaseModal>
 * ```
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';
import {
  modalSectionVariantClasses,
  sizeClasses,
  type ModalSectionVariant,
  type ModalSize,
} from '@/components/shared/baseModalStyles';
import { useBaseModalLifecycle } from '@/components/shared/useBaseModalLifecycle';

export interface BaseModalProps {
  /** Whether the modal is open/visible */
  isOpen: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** Title displayed in the modal header */
  title: React.ReactNode;
  /** Optional icon to display before the title */
  icon?: React.ReactNode;
  /** Size of the modal container */
  size?: ModalSize;
  /** Modal content */
  children: React.ReactNode;
  /** Optional custom class for the modal container */
  className?: string;
  /** Whether clicking the backdrop closes the modal (default: true) */
  closeOnBackdrop?: boolean;
  /** Whether to show the close button in header (default: true) */
  showCloseButton?: boolean;
  /** Custom header color class (default: 'text-accent-600') */
  headerIconColor?: string;
  /** Background variant (default: 'glass') */
  variant?: 'glass' | 'white';
  /** Whether the modal content should be printable (default: false) */
  printable?: boolean;
  /** Optional ref to the element that should receive focus when modal opens */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Optional additional actions to display in the header (before the close button) */
  headerActions?: React.ReactNode;
  /** Optional custom class for the scrollable body (default: 'p-6 space-y-6') */
  bodyClassName?: string;
  /** Whether the modal body should have internal scroll */
  scrollableBody?: boolean;
  /** Module theme identifier for accent color system (applied as data-module attribute) */
  dataModule?: string;
}

/**
 * BaseModal Component
 *
 * Provides a consistent modal layout with header, body, and styling.
 * Uses the application's glass morphism design system.
 */
export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  size = 'md',
  children,
  className,
  closeOnBackdrop = true,
  showCloseButton = true,
  headerIconColor = 'text-accent-600',
  variant = 'glass',
  printable = false,
  initialFocusRef,
  headerActions,
  bodyClassName,
  scrollableBody = true,
  dataModule,
}) => {
  const { modalRef } = useBaseModalLifecycle({ isOpen, onClose, initialFocusRef });

  // Don't render if not open
  if (!isOpen) return null;

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div
      className={clsx(
        'fixed inset-0 bg-slate-900/60 z-[100] backdrop-blur-sm animate-fade-in',
        scrollableBody ? 'flex items-center justify-center p-4' : 'overflow-y-auto p-4',
        !printable && 'print:hidden'
      )}
      style={{ isolation: 'isolate' }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        data-module={dataModule}
        className={clsx(
          'rounded-2xl shadow-2xl w-full animate-scale-in overflow-hidden',
          !scrollableBody && 'mx-auto my-4',
          variant === 'white' ? 'bg-white border border-slate-200' : 'glass border border-white/40',
          sizeClasses[size],
          className
        )}
      >
        {/* Header */}
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

        {/* Body */}
        <div
          className={clsx(
            scrollableBody ? 'max-h-[70vh] overflow-y-auto' : 'overflow-visible',
            bodyClassName || 'p-6 space-y-6'
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );

  // Render modal via portal to document.body to escape stacking context issues
  return createPortal(modalContent, document.body);
};

/**
 * ModalSection Component
 *
 * A styled section for use inside BaseModal body.
 * Provides consistent card styling for modal content groups.
 */
export interface ModalSectionProps {
  /** Section title */
  title: React.ReactNode;
  /** Optional icon for the section header */
  icon?: React.ReactNode;
  /** Description text or JSX below the title */
  description?: React.ReactNode;
  /** Section content */
  children: React.ReactNode;
  /** Border/header color variant */
  variant?: ModalSectionVariant;
  /** Optional additional class name */
  className?: string;
}

export const ModalSection: React.FC<ModalSectionProps> = ({
  title,
  icon,
  description,
  children,
  variant = 'default',
  className,
}) => {
  const colors = modalSectionVariantClasses[variant];

  return (
    <div className={clsx('bg-white/80 border p-4 rounded-xl shadow-sm', colors.border, className)}>
      <h4 className={clsx('font-display font-bold flex items-center gap-2 mb-2', colors.title)}>
        {icon}
        {title}
      </h4>
      {description && (
        <p className={clsx('text-xs mb-4 leading-relaxed', colors.desc)}>{description}</p>
      )}
      {children}
    </div>
  );
};

export default BaseModal;
