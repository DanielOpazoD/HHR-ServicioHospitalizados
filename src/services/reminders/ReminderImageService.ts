import { getActiveHospitalId } from '@/constants/firestorePaths';
import { defaultReminderStorageRuntime } from '@/services/firebase-runtime/reminderRuntime';
import { REMINDER_IMAGE_MAX_BYTES } from './reminderShared';

const sanitizeFileName = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');

const buildReminderImagePath = (reminderId: string, filename: string): string =>
  `reminders/${getActiveHospitalId()}/${reminderId}/${sanitizeFileName(filename)}`;

export interface ReminderImageServiceDependencies {
  runtime?: typeof defaultReminderStorageRuntime;
}

export const createReminderImageService = ({
  runtime = defaultReminderStorageRuntime,
}: ReminderImageServiceDependencies = {}) => ({
  async uploadImage(
    reminderId: string,
    file: File
  ): Promise<{ imageUrl: string; imagePath: string }> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Solo se permiten imágenes PNG, JPG o WEBP.');
    }
    if (file.size > REMINDER_IMAGE_MAX_BYTES) {
      throw new Error('La imagen supera el límite de 2MB.');
    }

    const storage = await runtime.getStorage();
    const imagePath = buildReminderImagePath(reminderId, file.name);
    const storageRef = runtime.ref(storage, imagePath);
    await runtime.uploadBytes(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        module: 'reminders',
        reminderId,
      },
    });
    const imageUrl = await runtime.getDownloadURL(storageRef);
    return { imageUrl, imagePath };
  },

  async deleteImage(imagePath?: string): Promise<void> {
    if (!imagePath) return;
    const storage = await runtime.getStorage();
    await runtime.deleteObject(runtime.ref(storage, imagePath));
  },
});

export const ReminderImageService = createReminderImageService();
