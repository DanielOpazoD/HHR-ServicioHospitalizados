import { useEffect, useState } from 'react';

const activeLocks = new Set<string>();

const updateBodyScroll = () => {
  if (activeLocks.size > 0) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
};

export const useCoreScrollLock = (isActive: boolean): void => {
  const [id] = useState(() => `core-lock-${Math.random().toString(36).slice(2, 11)}`);

  useEffect(() => {
    if (isActive) {
      activeLocks.add(id);
      updateBodyScroll();
    } else {
      activeLocks.delete(id);
      updateBodyScroll();
    }

    return () => {
      activeLocks.delete(id);
      updateBodyScroll();
    };
  }, [isActive, id]);
};
