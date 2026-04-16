import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, X } from 'lucide-react';

interface WoundCareToastProps {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
}

/**
 * Lightweight success toast rendered via portal.
 * Auto-dismisses after `durationMs` (default 3s).
 */
export const WoundCareToast: React.FC<WoundCareToastProps> = ({
  message,
  onDismiss,
  durationMs = 3000,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300); // Wait for exit animation
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onDismiss]);

  return createPortal(
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-600/20">
        <CheckCircle2 className="w-5 h-5 shrink-0" />
        <span className="text-sm font-medium">{message}</span>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            setTimeout(onDismiss, 300);
          }}
          className="p-0.5 text-white/60 hover:text-white transition-colors shrink-0"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>,
    document.body
  );
};
