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
import { type ModalSize } from '@/components/shared/baseModalStyles';
import {
  BaseModalBackdrop,
  BaseModalBody,
  BaseModalHeader,
} from '@/components/shared/baseModalLayout';
import {
  resolveBaseModalContainerClassName,
  shouldCloseBaseModalFromBackdropClick,
} from '@/components/shared/baseModalController';
export { ModalSection, type ModalSectionProps } from '@/components/shared/baseModalSection';
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
    if (
      shouldCloseBaseModalFromBackdropClick({
        closeOnBackdrop,
        target: e.target,
        currentTarget: e.currentTarget,
      })
    ) {
      onClose();
    }
  };

  const modalContent = (
    <BaseModalBackdrop
      printable={printable}
      scrollableBody={scrollableBody}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        data-module={dataModule}
        className={resolveBaseModalContainerClassName({
          scrollableBody,
          variant,
          size,
          className,
        })}
      >
        <BaseModalHeader
          title={title}
          icon={icon}
          onClose={onClose}
          showCloseButton={showCloseButton}
          headerIconColor={headerIconColor}
          variant={variant}
          headerActions={headerActions}
        />
        <BaseModalBody scrollableBody={scrollableBody} bodyClassName={bodyClassName}>
          {children}
        </BaseModalBody>
      </div>
    </BaseModalBackdrop>
  );

  // Render modal via portal to document.body to escape stacking context issues
  return createPortal(modalContent, document.body);
};

export default BaseModal;
