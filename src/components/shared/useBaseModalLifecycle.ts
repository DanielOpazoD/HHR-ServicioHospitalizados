import React from 'react';

import { useScrollLock } from '@/hooks/useScrollLock';

const focusFirstModalElement = (
  modalRef: React.RefObject<HTMLDivElement | null>,
  initialFocusRef?: React.RefObject<HTMLElement | null>
) => {
  if (initialFocusRef?.current) {
    initialFocusRef.current.focus();
    return;
  }

  if (!modalRef.current) {
    return;
  }

  const bodyFocusable = modalRef.current.querySelector(
    'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
  ) as HTMLElement | null;

  if (bodyFocusable) {
    bodyFocusable.focus();
    return;
  }

  const firstFocusable = modalRef.current.querySelector(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ) as HTMLElement | null;

  firstFocusable?.focus();
};

const trapModalTabNavigation = (
  event: KeyboardEvent,
  modalRef: React.RefObject<HTMLDivElement | null>
) => {
  if (event.key !== 'Tab' || !modalRef.current) {
    return;
  }

  const focusableElements = modalRef.current.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0] as HTMLElement | undefined;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement | undefined;

  if (!firstElement || !lastElement) {
    return;
  }

  if (event.shiftKey && document.activeElement === firstElement) {
    lastElement.focus();
    event.preventDefault();
    return;
  }

  if (!event.shiftKey && document.activeElement === lastElement) {
    firstElement.focus();
    event.preventDefault();
  }
};

export const useBaseModalLifecycle = ({
  isOpen,
  onClose,
  initialFocusRef,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}) => {
  const modalRef = React.useRef<HTMLDivElement>(null);
  const onCloseRef = React.useRef(onClose);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useScrollLock(isOpen);

  React.useEffect(() => {
    if (!isOpen) {
      return () => undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
      }

      trapModalTabNavigation(event, modalRef);
    };

    document.addEventListener('keydown', handleKeyDown);
    const focusTimeout = window.setTimeout(
      () => focusFirstModalElement(modalRef, initialFocusRef),
      100
    );

    return () => {
      window.clearTimeout(focusTimeout);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [initialFocusRef, isOpen]);

  return { modalRef };
};
