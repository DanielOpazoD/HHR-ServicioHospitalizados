import React from 'react';
import { createReminderUseCases } from '@/application/reminders/reminderUseCases';
import { useAuth } from '@/context/AuthContext';
import { useConfirmDialog, useNotification } from '@/context/UIContext';
import {
  buildReminderFromDraft,
  validateReminderDraft,
  type ReminderDraftInput,
} from '@/domain/reminders';
import { resolveReminderAdminErrorMessage } from '@/services/reminders';
import type { Reminder, ReminderReadReceipt } from '@/types/reminders';

const buildReminderId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `reminder-${crypto.randomUUID()}`;
  }
  return `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export interface ReminderAdminSubmission {
  draft: ReminderDraftInput;
  imageFile: File | null;
  removeImage: boolean;
}

type ReminderSaveResult =
  | 'saved_without_image'
  | 'saved_with_image'
  | 'permission_denied_image_upload';

export const useReminderAdmin = () => {
  const reminderUseCases = React.useMemo(() => createReminderUseCases(), []);
  const { currentUser } = useAuth();
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [processing, setProcessing] = React.useState(false);
  const [formReminder, setFormReminder] = React.useState<Reminder | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [receiptsReminder, setReceiptsReminder] = React.useState<Reminder | null>(null);
  const [readReceipts, setReadReceipts] = React.useState<ReminderReadReceipt[]>([]);
  const [receiptsLoading, setReceiptsLoading] = React.useState(false);

  React.useEffect(() => {
    setLoadError(null);
    const unsubscribe = reminderUseCases.subscribeToReminderFeed({
      onOutcome: outcome => {
        const nextReminders = outcome.data;
        setReminders(nextReminders);
        setLoading(false);
        if (outcome.status === 'degraded' || outcome.status === 'failed') {
          setLoading(false);
          setLoadError(
            outcome.userSafeMessage ||
              outcome.issues[0]?.userSafeMessage ||
              resolveReminderAdminErrorMessage(outcome.issues[0]?.message, {
                operation: 'firestore_read',
              })
          );
        }
      },
    });
    return unsubscribe;
  }, [reminderUseCases]);

  const openCreateForm = React.useCallback(() => {
    setFormReminder(null);
    setIsFormOpen(true);
  }, []);

  const openEditForm = React.useCallback((reminder: Reminder) => {
    setFormReminder(reminder);
    setIsFormOpen(true);
  }, []);

  const closeForm = React.useCallback(() => {
    if (processing) return;
    setIsFormOpen(false);
    setFormReminder(null);
  }, [processing]);

  const saveReminder = React.useCallback(
    async ({ draft, imageFile, removeImage }: ReminderAdminSubmission) => {
      const issues = validateReminderDraft(draft);
      if (issues.length > 0) {
        notifyError('Avisos al personal', issues[0].message);
        return false;
      }

      const reminderId = formReminder?.id ?? buildReminderId();
      const now = new Date().toISOString();
      const previousImagePath = formReminder?.imagePath;
      const nextImageWasRemoved = removeImage && Boolean(previousImagePath);

      setProcessing(true);
      try {
        const reminder = buildReminderFromDraft(
          reminderId,
          {
            ...draft,
            imageUrl: removeImage ? undefined : formReminder?.imageUrl,
          },
          {
            createdBy: currentUser?.uid ?? 'system',
            createdByName:
              currentUser?.displayName?.trim() || currentUser?.email?.trim() || 'Jefatura',
            createdAt: now,
            updatedAt: now,
          },
          formReminder
        );

        const createResult = await reminderUseCases.createReminder({
          ...reminder,
          imageUrl: removeImage ? undefined : reminder.imageUrl,
          imagePath: removeImage ? undefined : formReminder?.imagePath,
        });

        if (createResult.status !== 'success') {
          throw new Error(createResult.userSafeMessage || 'No se pudo crear el aviso.');
        }

        let saveResult: ReminderSaveResult = 'saved_without_image';

        if (nextImageWasRemoved && previousImagePath) {
          const deleteImageResult = await reminderUseCases.deleteReminderImage(previousImagePath);
          if (deleteImageResult.status !== 'success') {
            notifyError(
              'Avisos al personal',
              deleteImageResult.userSafeMessage || 'No se pudo eliminar la imagen del aviso.'
            );
          }
        }

        if (imageFile) {
          const uploadResult = await reminderUseCases.uploadReminderImage({
            reminderId,
            file: imageFile,
          });
          if (uploadResult.status === 'success' && uploadResult.data) {
            const updateResult = await reminderUseCases.updateReminder(reminderId, {
              imageUrl: uploadResult.data.imageUrl,
              imagePath: uploadResult.data.imagePath,
              updatedAt: new Date().toISOString(),
            });

            if (updateResult.status !== 'success') {
              throw new Error(updateResult.userSafeMessage || 'No se pudo actualizar el aviso.');
            }

            if (previousImagePath && previousImagePath !== uploadResult.data.imagePath) {
              const previousDeleteResult =
                await reminderUseCases.deleteReminderImage(previousImagePath);
              if (previousDeleteResult.status !== 'success') {
                notifyError(
                  'Avisos al personal',
                  previousDeleteResult.userSafeMessage ||
                    'No se pudo eliminar la imagen anterior del aviso.'
                );
              }
            }

            saveResult = 'saved_with_image';
          } else {
            saveResult = 'permission_denied_image_upload';
            notifyError(
              'Avisos al personal',
              uploadResult.userSafeMessage || 'No se pudo subir la imagen del aviso.'
            );
          }
        }

        success('Avisos al personal', resolveSaveResultMessage(formReminder, saveResult));
        setIsFormOpen(false);
        setFormReminder(null);
        return true;
      } catch (error) {
        notifyError(
          'Avisos al personal',
          resolveReminderAdminErrorMessage(error, { operation: 'firestore_write' })
        );
        return false;
      } finally {
        setProcessing(false);
      }
    },
    [
      currentUser?.displayName,
      currentUser?.email,
      currentUser?.uid,
      formReminder,
      notifyError,
      reminderUseCases,
      success,
    ]
  );

  const deleteReminder = React.useCallback(
    async (reminder: Reminder) => {
      const accepted = await confirm({
        title: 'Eliminar aviso',
        message: `Se eliminará "${reminder.title}" y sus lecturas asociadas dejarán de estar disponibles.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        variant: 'warning',
      });

      if (!accepted) return;

      setProcessing(true);
      try {
        const removeResult = await reminderUseCases.deleteReminder(reminder.id);
        if (removeResult.status !== 'success') {
          throw new Error(removeResult.userSafeMessage || 'No se pudo eliminar el aviso.');
        }
        await reminderUseCases.deleteReminderImage(reminder.imagePath);
        success('Avisos al personal', 'El aviso fue eliminado.');
      } catch (error) {
        notifyError(
          'Avisos al personal',
          error instanceof Error ? error.message : 'No se pudo eliminar el aviso.'
        );
      } finally {
        setProcessing(false);
      }
    },
    [confirm, notifyError, reminderUseCases, success]
  );

  const openReadStatus = React.useCallback(
    async (reminder: Reminder) => {
      setReceiptsReminder(reminder);
      setReceiptsLoading(true);
      try {
        const result = await reminderUseCases.getReminderReadReceipts(reminder.id);
        setReadReceipts(result.data);
        if (result.status !== 'success') {
          notifyError(
            'Avisos al personal',
            result.userSafeMessage || 'No se pudo cargar el detalle de lecturas.'
          );
        }
      } finally {
        setReceiptsLoading(false);
      }
    },
    [notifyError, reminderUseCases]
  );

  const closeReadStatus = React.useCallback(() => {
    setReceiptsReminder(null);
    setReadReceipts([]);
    setReceiptsLoading(false);
  }, []);

  return {
    reminders,
    loading,
    loadError,
    processing,
    isFormOpen,
    formReminder,
    openCreateForm,
    openEditForm,
    closeForm,
    saveReminder,
    deleteReminder,
    receiptsReminder,
    readReceipts,
    receiptsLoading,
    openReadStatus,
    closeReadStatus,
  };
};

const resolveSaveResultMessage = (
  formReminder: Reminder | null,
  result: ReminderSaveResult
): string => {
  if (result === 'saved_with_image') {
    return formReminder
      ? 'El aviso fue actualizado con su imagen.'
      : 'El aviso fue creado con su imagen.';
  }

  if (result === 'permission_denied_image_upload') {
    return formReminder
      ? 'El aviso fue actualizado, pero la imagen no pudo subirse.'
      : 'El aviso fue creado, pero la imagen no pudo subirse.';
  }
  return formReminder ? 'El aviso fue actualizado.' : 'El aviso fue creado.';
};
