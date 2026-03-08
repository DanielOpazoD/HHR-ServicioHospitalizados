import React from 'react';
import { ChevronRight, Folder, HardDriveUpload, Loader2 } from 'lucide-react';

import { BaseModal } from '@/components/shared/BaseModal';
import type { ClinicalDocumentDriveFolder } from '@/features/clinical-documents/services/clinicalDocumentDriveService';

interface ClinicalDocumentDriveFolderLocation {
  id: string;
  name: string;
  path: string;
}

interface ClinicalDocumentDriveFolderPickerProps {
  isOpen: boolean;
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;
  currentLocation: ClinicalDocumentDriveFolderLocation;
  breadcrumbs: ClinicalDocumentDriveFolderLocation[];
  folders: ClinicalDocumentDriveFolder[];
  onClose: () => void;
  onEnterFolder: (folder: ClinicalDocumentDriveFolder) => void;
  onNavigateBreadcrumb: (location: ClinicalDocumentDriveFolderLocation) => void;
  onConfirm: () => void;
}

export const ClinicalDocumentDriveFolderPicker: React.FC<
  ClinicalDocumentDriveFolderPickerProps
> = ({
  isOpen,
  isLoading,
  isUploading,
  error,
  currentLocation,
  breadcrumbs,
  folders,
  onClose,
  onEnterFolder,
  onNavigateBreadcrumb,
  onConfirm,
}) => (
  <BaseModal
    isOpen={isOpen}
    onClose={onClose}
    title="Seleccionar carpeta en Google Drive"
    size="xl"
    variant="white"
    bodyClassName="p-0"
  >
    <div className="border-b border-slate-200 px-6 py-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Ruta actual</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {breadcrumbs.map((location, index) => (
          <React.Fragment key={location.id}>
            {index > 0 && <ChevronRight size={14} className="text-slate-400" />}
            <button
              type="button"
              onClick={() => void onNavigateBreadcrumb(location)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
              disabled={isLoading || isUploading}
            >
              {location.name}
            </button>
          </React.Fragment>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">{currentLocation.path}</p>
    </div>

    <div className="px-6 py-4 space-y-4">
      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Cargando carpetas...
          </div>
        ) : folders.length > 0 ? (
          <ul className="divide-y divide-slate-200">
            {folders.map(folder => (
              <li key={folder.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Folder size={16} className="text-blue-600" />
                    <span className="truncate">{folder.name}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{folder.path}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void onEnterFolder(folder)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  disabled={isUploading}
                >
                  Abrir
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-8 text-sm text-slate-500">
            No hay subcarpetas disponibles aquí. Puedes guardar el PDF en esta carpeta.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          disabled={isUploading}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-xl border border-blue-200 bg-blue-600 px-4 py-2 text-sm font-black uppercase tracking-widest text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={isLoading || isUploading}
        >
          <HardDriveUpload size={14} className="inline mr-2" />
          {isUploading ? 'Guardando...' : 'Guardar aquí'}
        </button>
      </div>
    </div>
  </BaseModal>
);
