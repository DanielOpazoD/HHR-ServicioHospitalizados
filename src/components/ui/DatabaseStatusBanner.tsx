import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import {
  getStorageFallbackUiCopy,
  shouldShowStorageFallbackUi,
} from '@/services/storage/storageFallbackUiPolicy';
import { defaultBrowserWindowRuntime } from '@/shared/runtime/browserWindowRuntime';
import { useDatabaseFallbackStatus } from '@/hooks/useDatabaseFallbackStatus';

export const DatabaseStatusBanner: React.FC = () => {
  const isFallbackMode = useDatabaseFallbackStatus();
  const copy = getStorageFallbackUiCopy();

  if (!shouldShowStorageFallbackUi(isFallbackMode)) return null;

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between shadow-lg sticky top-0 z-[100]">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5" />
        <div>
          <span className="font-bold">{copy.title}</span>
          <span className="ml-2 text-sm opacity-90">{copy.summary}</span>
        </div>
      </div>

      <button
        onClick={defaultBrowserWindowRuntime.reload}
        className="flex items-center gap-2 bg-white/30 hover:bg-white/40 px-3 py-1 rounded text-sm transition-colors border border-amber-950/20"
      >
        <RefreshCw className="h-4 w-4" />
        {copy.primaryActionLabel}
      </button>
    </div>
  );
};
