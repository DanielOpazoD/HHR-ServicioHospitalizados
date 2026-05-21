import { useCallback, useEffect, useState } from 'react';

import {
  executeDeleteClinicalAttachment,
  executeListClinicalAttachmentsByEpisode,
  executeUploadClinicalAttachment,
} from '@/application/clinical-documents/clinicalAttachmentUseCases';
import { buildClinicalDocumentActor } from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import type {
  ClinicalAttachmentRecord,
  ClinicalDocumentRecord,
} from '@/features/clinical-documents/domain/entities';

interface ClinicalAttachmentNotificationPort {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

interface UseClinicalAttachmentsParams {
  selectedDocument: ClinicalDocumentRecord | null;
  hospitalId: string;
  canEdit: boolean;
  user: { uid?: string; email?: string | null; displayName?: string | null } | null;
  role: string | null;
  notify: ClinicalAttachmentNotificationPort;
}

export const useClinicalAttachments = ({
  selectedDocument,
  hospitalId,
  canEdit,
  user,
  role,
  notify,
}: UseClinicalAttachmentsParams) => {
  const [attachments, setAttachments] = useState<ClinicalAttachmentRecord[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  const loadAttachments = useCallback(async () => {
    if (!selectedDocument) {
      setAttachments([]);
      return;
    }

    setIsLoadingAttachments(true);
    const outcome = await executeListClinicalAttachmentsByEpisode({
      episodeKey: selectedDocument.episodeKey,
      hospitalId,
    });
    setIsLoadingAttachments(false);

    if (outcome.status === 'failed') {
      notify.error('No se pudieron cargar adjuntos', outcome.userSafeMessage);
      return;
    }

    setAttachments(outcome.data);
  }, [hospitalId, notify, selectedDocument]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!selectedDocument) {
        setAttachments([]);
        return;
      }
      setIsLoadingAttachments(true);
      const outcome = await executeListClinicalAttachmentsByEpisode({
        episodeKey: selectedDocument.episodeKey,
        hospitalId,
      });
      if (cancelled) return;
      setIsLoadingAttachments(false);
      if (outcome.status === 'failed') {
        notify.error('No se pudieron cargar adjuntos', outcome.userSafeMessage);
        return;
      }
      setAttachments(outcome.data);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [hospitalId, notify, selectedDocument]);

  const uploadAttachment = useCallback(
    async (file: File) => {
      if (!selectedDocument || !canEdit) return;
      setIsUploadingAttachment(true);
      const outcome = await executeUploadClinicalAttachment({
        hospitalId,
        patientRut: selectedDocument.patientRut,
        patientName: selectedDocument.patientName,
        episodeKey: selectedDocument.episodeKey,
        admissionDate: selectedDocument.admissionDate,
        sourceDailyRecordDate: selectedDocument.sourceDailyRecordDate,
        bedId: selectedDocument.sourceBedId,
        documentId: selectedDocument.id,
        documentType: selectedDocument.documentType,
        file,
        actor: buildClinicalDocumentActor(user, role),
      });
      setIsUploadingAttachment(false);

      if (outcome.status === 'failed' || !outcome.data) {
        notify.error('No se pudo subir el adjunto', outcome.userSafeMessage);
        return;
      }

      setAttachments(current => [outcome.data!, ...current]);
      notify.success('Adjunto guardado', 'El archivo quedó asociado a esta hospitalización.');
    },
    [canEdit, hospitalId, notify, role, selectedDocument, user]
  );

  const deleteAttachment = useCallback(
    async (attachment: ClinicalAttachmentRecord) => {
      if (!canEdit) return;
      const outcome = await executeDeleteClinicalAttachment({
        attachmentId: attachment.id,
        hospitalId: attachment.hospitalId,
        storagePath: attachment.storagePath,
        actor: buildClinicalDocumentActor(user, role),
      });

      if (outcome.status === 'failed') {
        notify.error('No se pudo eliminar el adjunto', outcome.userSafeMessage);
        return;
      }

      setAttachments(current => current.filter(item => item.id !== attachment.id));
      notify.info('Adjunto eliminado', 'El archivo ya no se muestra en esta hospitalización.');
    },
    [canEdit, notify, role, user]
  );

  return {
    attachments,
    isLoadingAttachments,
    isUploadingAttachment,
    loadAttachments,
    uploadAttachment,
    deleteAttachment,
  };
};
