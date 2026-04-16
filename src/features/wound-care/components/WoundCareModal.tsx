import React, { useState } from 'react';
import { Camera, FileText, Printer, ChevronDown, ChevronRight } from 'lucide-react';
import { BaseModal } from '@/components/shared/BaseModal';
import type { EpisodeContext } from '@/application/wound-care/woundCareUseCases';
import { useWoundCareHistory, type EpisodePhotoGroup } from '../hooks/useWoundCareHistory';
import { useWoundCareUpload } from '../hooks/useWoundCareUpload';
import { ConsentStatus } from './ConsentStatus';
import { ConsentUploadModal } from './ConsentUploadModal';
import { PhotoUploadButton } from './PhotoUploadButton';
import { PhotoUploadModal } from './PhotoUploadModal';
import { generateConsentPdf } from '../services/consentPdfGenerator';
import { WoundCareToast } from './WoundCareToast';
import { PhotoGallery } from './PhotoGallery';
import { WoundCareErrorBoundary } from './WoundCareErrorBoundary';
import { formatSessionDate } from '../controllers/photoGalleryController';

// ============================================================================
// Episode Section (collapsible per hospitalization)
// ============================================================================

interface EpisodeSectionProps {
  group: EpisodePhotoGroup;
  readOnly: boolean;
  onFileSelected: (file: File) => void;
  onDelete: (photo: {
    id: string;
    storagePath: string;
    thumbnailStoragePath: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onEditDescription?: (photoId: string, description: string) => Promise<void>;
  onConsentAction: () => void;
  onPrintConsent: () => void;
}

const EpisodeSection: React.FC<EpisodeSectionProps> = ({
  group,
  readOnly,
  onFileSelected,
  onDelete,
  onEditDescription,
  onConsentAction,
  onPrintConsent,
}) => {
  const [isExpanded, setIsExpanded] = useState(group.isCurrent);

  const admissionDate = group.episodeKey.split('__')[1] || '';
  const label = group.isCurrent
    ? `Hospitalización actual (${formatSessionDate(admissionDate)})`
    : `Hospitalización ${formatSessionDate(admissionDate)}`;

  return (
    <div
      className={`border border-slate-200 rounded-lg overflow-hidden ${group.isCurrent ? 'border-l-2 border-l-sky-400' : 'bg-slate-50/50'}`}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
        <span className="text-sm font-medium text-slate-700 flex-1">{label}</span>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${group.photos.length > 0 ? 'bg-sky-100 text-sky-700' : 'text-slate-400'}`}
        >
          {group.photos.length === 0
            ? 'Sin fotos'
            : `${group.photos.length} foto${group.photos.length > 1 ? 's' : ''}`}
        </span>
        {group.consent && (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
            <FileText className="w-3 h-3" />
            CI
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="px-3 py-3 space-y-3 border-t border-slate-200">
          {/* Actions for current episode */}
          {group.isCurrent && !readOnly && (
            <div className="flex flex-col gap-2">
              {/* Photo actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <PhotoUploadButton onFileSelected={onFileSelected} />
              </div>
              {/* Consent actions — subtle, secondary row */}
              <div className="flex items-center gap-2 flex-wrap border-t border-slate-100 pt-2">
                <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                  Consentimiento:
                </span>
                <button
                  type="button"
                  onClick={onConsentAction}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors touch-manipulation"
                  title="Subir consentimiento firmado"
                >
                  <FileText className="w-4 h-4" />
                  <span>Subir CI</span>
                </button>
                <button
                  type="button"
                  onClick={onPrintConsent}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors touch-manipulation"
                  title="Imprimir formulario de consentimiento"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir CI</span>
                </button>
                {group.consent?.status === 'signed' && (
                  <ConsentStatus consent={group.consent} onAction={onConsentAction} readOnly />
                )}
              </div>
            </div>
          )}

          {/* Previous episode: view-only consent status */}
          {!group.isCurrent && group.consent?.status === 'signed' && (
            <ConsentStatus consent={group.consent} onAction={onConsentAction} readOnly />
          )}

          <PhotoGallery
            photos={group.photos}
            readOnly={readOnly || !group.isCurrent}
            onDelete={!readOnly && group.isCurrent ? onDelete : undefined}
            onEditDescription={!readOnly && group.isCurrent ? onEditDescription : undefined}
          />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Modal
// ============================================================================

interface WoundCareModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  patientRut: string;
  episodeContext: EpisodeContext;
  readOnly?: boolean;
}

export const WoundCareModal: React.FC<WoundCareModalProps> = ({
  isOpen,
  onClose,
  patientName,
  patientRut,
  episodeContext,
  readOnly = false,
}) => {
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { episodes, isLoading, reload } = useWoundCareHistory({
    patientRut: isOpen ? patientRut : undefined,
    currentEpisodeKey: episodeContext.episodeKey,
  });
  const { deletePhoto } = useWoundCareUpload();

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setShowPhotoModal(true);
  };

  const handleDeletePhoto = async (photo: {
    id: string;
    storagePath: string;
    thumbnailStoragePath: string;
  }) => {
    const result = await deletePhoto(photo.id, photo.storagePath, photo.thumbnailStoragePath);
    if (result.success) {
      reload();
      showToast('Foto eliminada');
    }
    return result;
  };

  const showToast = (msg: string) => setToastMessage(msg);

  const handleEditDescription = async (photoId: string, description: string) => {
    const { executeUpdatePhotoDescription } =
      await import('@/application/wound-care/woundCareUseCases');
    await executeUpdatePhotoDescription(photoId, description);
    reload();
    showToast('Descripción actualizada');
  };

  const currentConsent = episodes.find(e => e.isCurrent)?.consent ?? null;

  const handlePrintConsent = () => {
    const admissionDate = episodeContext.episodeKey.split('__')[1];
    generateConsentPdf({ patientName, patientRut, admissionDate });
  };

  return (
    <>
      <BaseModal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <span className="truncate">
            <Camera className="w-4 h-4 inline mr-1.5" />
            Curaciones — {patientName}
          </span>
        }
        size="lg"
        scrollableBody
      >
        <WoundCareErrorBoundary patientName={patientName}>
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-sky-500 rounded-full animate-spin" />
                <p className="text-sm text-slate-400 mt-3">Cargando historial...</p>
              </div>
            ) : episodes.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                  <Camera className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">Sin registro fotográfico</p>
                <p className="text-xs text-slate-400 mt-1">
                  Las fotos de curaciones aparecerán aquí
                </p>
                {!readOnly && (
                  <div className="mt-4 flex justify-center gap-2">
                    <PhotoUploadButton onFileSelected={handleFileSelected} />
                  </div>
                )}
              </div>
            ) : (
              episodes.map(group => (
                <EpisodeSection
                  key={group.episodeKey}
                  group={group}
                  readOnly={readOnly}
                  onFileSelected={handleFileSelected}
                  onDelete={handleDeletePhoto}
                  onEditDescription={handleEditDescription}
                  onConsentAction={() => setShowConsentModal(true)}
                  onPrintConsent={handlePrintConsent}
                />
              ))
            )}
          </div>
        </WoundCareErrorBoundary>
      </BaseModal>

      {showConsentModal && (
        <ConsentUploadModal
          isOpen
          onClose={() => {
            setShowConsentModal(false);
            reload();
            showToast('Consentimiento guardado');
          }}
          episodeContext={episodeContext}
          existingConsent={currentConsent}
        />
      )}

      {showPhotoModal && (
        <PhotoUploadModal
          isOpen
          onClose={() => {
            setShowPhotoModal(false);
            setSelectedFile(null);
            reload();
            showToast('Foto subida exitosamente');
          }}
          file={selectedFile}
          episodeContext={episodeContext}
        />
      )}

      {toastMessage && (
        <WoundCareToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
    </>
  );
};
