import React from 'react';
import clsx from 'clsx';
import {
  modalSectionVariantClasses,
  type ModalSectionVariant,
} from '@/components/shared/baseModalStyles';

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
