import React from 'react';
import { Printer, Loader2, Save, CheckCircle } from 'lucide-react';
import clsx from 'clsx';
import { useDropdownMenu } from '@/hooks/useDropdownMenu';
import { resolveSaveButtonUiState } from './dateStripActionStateController';
import { DateStripDropdownPanel } from './DateStripDropdownPanel';
import { DateStripActionItem } from './DateStripActionItem';
import type { HandoffSaveDropdownProps } from './types';

export const HandoffSaveDropdown: React.FC<HandoffSaveDropdownProps> = ({
  onExportPDF,
  onBackupPDF,
  isArchived = false,
  isBackingUp,
  showFirebaseBackupOption = true,
}) => {
  const { isOpen, menuRef, toggle, close } = useDropdownMenu();

  const handleAction = async (action: 'pdf' | 'backup') => {
    close();

    if (action === 'pdf') {
      await onExportPDF?.();
      await onBackupPDF?.(true);
      return;
    }

    await onBackupPDF?.(false);
  };

  if (!onExportPDF && !onBackupPDF) {
    return null;
  }

  const uiState = resolveSaveButtonUiState({
    isArchived,
    isBackingUp,
    variant: 'handoff',
  });

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={toggle}
        disabled={isBackingUp}
        className={clsx(
          'btn !px-2 !py-1.5 text-[10px] flex items-center justify-center transition-all',
          uiState.buttonClassName,
          uiState.widthClassName
        )}
        title="Opciones de guardado (PDF/Nube)"
        aria-label={uiState.label}
        data-save-status={isBackingUp ? 'loading' : isArchived ? 'archived' : 'idle'}
      >
        {uiState.iconKind === 'loading' && <Loader2 size={14} className="animate-spin" />}
        {uiState.iconKind === 'archived' && <CheckCircle size={14} />}
        {uiState.iconKind === 'default' && <Save size={14} />}
      </button>

      {isOpen && (
        <DateStripDropdownPanel title="Opciones de Guardado" widthClassName="w-52">
          <DateStripActionItem
            onClick={() => void handleAction('pdf')}
            icon={Printer}
            title="Descargar PDF"
            subtitle="Exportación local inmediata"
            colorClassName="bg-emerald-50 text-emerald-600"
            iconHoverColorClassName="group-hover:bg-emerald-100"
          />

          {showFirebaseBackupOption && (
            <DateStripActionItem
              onClick={() => void handleAction('backup')}
              icon={Save}
              title="Respaldo en Firebase"
              subtitle="Respaldo seguro en Firebase"
              colorClassName="bg-amber-50 text-amber-600"
              iconHoverColorClassName="group-hover:bg-amber-100"
            />
          )}
        </DateStripDropdownPanel>
      )}
    </div>
  );
};
