import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from 'firebase/storage';
import { firestoreDb, type IDatabaseProvider } from '@/services/storage/firestore';
import { defaultStorageRuntime } from '@/services/firebase-runtime/storageRuntime';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';

export const USER_AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export interface UserAvatarProfile {
  uid: string;
  email: string;
  photoURL: string;
  storagePath: string;
  updatedAt: string;
}

export interface UserAvatarUploadInput {
  uid: string;
  email?: string | null;
  file: File;
}

interface UserSettingsDocument {
  userAvatarProfile?: Partial<UserAvatarProfile> | null;
}

export interface UserAvatarStorageRuntime {
  getStorage: () => Promise<FirebaseStorage>;
  ref: typeof ref;
  uploadBytes: typeof uploadBytes;
  getDownloadURL: typeof getDownloadURL;
  deleteObject: typeof deleteObject;
}

interface UserAvatarRepository {
  getDoc: IDatabaseProvider['getDoc'];
  setDoc: IDatabaseProvider['setDoc'];
  subscribeDoc?: IDatabaseProvider['subscribeDoc'];
}

interface UserAvatarProfileServiceDependencies {
  repository?: UserAvatarRepository;
  storageRuntime?: UserAvatarStorageRuntime;
  now?: () => string;
}

const USER_SETTINGS_COLLECTION = 'userSettings';
const LOCAL_USER_AVATAR_PROFILES_KEY = 'hhr_user_avatar_profiles_v1';

const defaultUserAvatarStorageRuntime: UserAvatarStorageRuntime = {
  getStorage: defaultStorageRuntime.getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
};

const normalizeUid = (uid: string): string => String(uid || '').trim();

const readLocalProfiles = (): Record<string, UserAvatarProfile> => {
  try {
    const raw = globalThis.localStorage?.getItem(LOCAL_USER_AVATAR_PROFILES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, UserAvatarProfile>) : {};
  } catch {
    return {};
  }
};

export const readCachedUserAvatarProfile = (
  uidInput: string | null | undefined
): UserAvatarProfile | null => {
  const uid = normalizeUid(uidInput || '');
  if (!uid) {
    return null;
  }
  return readLocalProfiles()[uid] || null;
};

export const writeCachedUserAvatarProfile = (
  profile: UserAvatarProfile | null,
  uidInput: string
): void => {
  const uid = normalizeUid(uidInput);
  if (!uid) {
    return;
  }
  try {
    const profiles = readLocalProfiles();
    if (profile) {
      profiles[uid] = profile;
    } else {
      delete profiles[uid];
    }
    globalThis.localStorage?.setItem(LOCAL_USER_AVATAR_PROFILES_KEY, JSON.stringify(profiles));
  } catch {
    // Local fallback must not block the authenticated shell.
  }
};

export const buildUserAvatarStoragePath = (uid: string): string =>
  `user-avatars/${normalizeUid(uid)}/avatar`;

const buildFirestoreBackedAvatarPath = (uid: string): string => `firestore:user-avatar:${uid}`;

const appendVersionToUrl = (url: string, version: string): string => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
};

const parseProfile = (
  uid: string,
  value: Partial<UserAvatarProfile> | null | undefined
): UserAvatarProfile | null => {
  const photoURL = String(value?.photoURL || '').trim();
  const storagePath = String(value?.storagePath || '').trim();
  if (!photoURL || !storagePath) {
    return null;
  }

  return {
    uid,
    email: String(value?.email || ''),
    photoURL,
    storagePath,
    updatedAt: String(value?.updatedAt || ''),
  };
};

const assertValidAvatarFile = (file: File): void => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Solo se permiten imágenes PNG, JPG o WEBP.');
  }
  if (file.size > USER_AVATAR_MAX_BYTES) {
    throw new Error('La imagen supera el límite de 2MB.');
  }
};

const isObjectNotFoundError = (error: unknown): boolean => {
  const code = String((error as { code?: string })?.code || '');
  return code.includes('object-not-found');
};

const isStorageUnauthorizedError = (error: unknown): boolean => {
  const code = String((error as { code?: string })?.code || '');
  return code.includes('storage/unauthorized') || code.includes('unauthorized');
};

const isFirestoreBackedAvatarPath = (storagePath: string): boolean =>
  storagePath.startsWith('firestore:user-avatar:');

const blobToDataUrl = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo preparar la foto de perfil.'));
    reader.readAsDataURL(file);
  });
};

export const createUserAvatarProfileService = ({
  repository = firestoreDb,
  storageRuntime = defaultUserAvatarStorageRuntime,
  now = () => new Date().toISOString(),
}: UserAvatarProfileServiceDependencies = {}) => {
  const getProfile = async (uid: string): Promise<UserAvatarProfile | null> => {
    const normalizedUid = normalizeUid(uid);
    if (!normalizedUid) {
      return null;
    }

    if (!isFirestoreEnabled()) {
      return readLocalProfiles()[normalizedUid] || null;
    }

    const settings = await repository.getDoc<UserSettingsDocument>(
      USER_SETTINGS_COLLECTION,
      normalizedUid
    );
    const profile = parseProfile(normalizedUid, settings?.userAvatarProfile);
    writeCachedUserAvatarProfile(profile, normalizedUid);
    return profile;
  };

  return {
    getProfile,

    subscribeProfile(
      uid: string,
      onProfile: (profile: UserAvatarProfile | null) => void,
      onError?: (error: unknown) => void
    ): () => void {
      const normalizedUid = normalizeUid(uid);
      if (!normalizedUid || !isFirestoreEnabled() || !repository.subscribeDoc) {
        void getProfile(normalizedUid)
          .then(onProfile)
          .catch(error => onError?.(error));
        return () => {};
      }

      try {
        return repository.subscribeDoc<UserSettingsDocument>(
          USER_SETTINGS_COLLECTION,
          normalizedUid,
          settings => {
            const profile = parseProfile(normalizedUid, settings?.userAvatarProfile);
            writeCachedUserAvatarProfile(profile, normalizedUid);
            onProfile(profile);
          }
        );
      } catch (error) {
        onError?.(error);
        return () => {};
      }
    },

    async uploadAvatar(input: UserAvatarUploadInput): Promise<UserAvatarProfile> {
      const uid = normalizeUid(input.uid);
      if (!uid) {
        throw new Error('No se pudo identificar al usuario actual.');
      }
      assertValidAvatarFile(input.file);

      const storage = await storageRuntime.getStorage();
      const storagePath = buildUserAvatarStoragePath(uid);
      const storageRef = storageRuntime.ref(storage, storagePath);
      const updatedAt = now();
      let profile: UserAvatarProfile;

      try {
        await storageRuntime.uploadBytes(storageRef, input.file, {
          contentType: input.file.type,
          customMetadata: {
            module: 'user-profile',
            userId: uid,
          },
        });

        const downloadUrl = await storageRuntime.getDownloadURL(storageRef);
        profile = {
          uid,
          email: String(input.email || '').trim(),
          photoURL: appendVersionToUrl(downloadUrl, updatedAt),
          storagePath,
          updatedAt,
        };
      } catch (error) {
        if (!isStorageUnauthorizedError(error)) {
          throw error;
        }

        profile = {
          uid,
          email: String(input.email || '').trim(),
          photoURL: await blobToDataUrl(input.file),
          storagePath: buildFirestoreBackedAvatarPath(uid),
          updatedAt,
        };
      }

      if (!isFirestoreEnabled()) {
        writeCachedUserAvatarProfile(profile, uid);
        return profile;
      }

      await repository.setDoc<UserSettingsDocument>(
        USER_SETTINGS_COLLECTION,
        uid,
        { userAvatarProfile: profile },
        { merge: true }
      );
      writeCachedUserAvatarProfile(profile, uid);
      return profile;
    },

    async removeAvatar(uidInput: string): Promise<void> {
      const uid = normalizeUid(uidInput);
      if (!uid) {
        return;
      }

      const profile = await getProfile(uid);
      if (profile?.storagePath && !isFirestoreBackedAvatarPath(profile.storagePath)) {
        const storage = await storageRuntime.getStorage();
        const storageRef = storageRuntime.ref(storage, profile.storagePath);
        try {
          await storageRuntime.deleteObject(storageRef);
        } catch (error) {
          if (!isObjectNotFoundError(error)) {
            throw error;
          }
        }
      }

      if (!isFirestoreEnabled()) {
        writeCachedUserAvatarProfile(null, uid);
        return;
      }

      await repository.setDoc<UserSettingsDocument>(
        USER_SETTINGS_COLLECTION,
        uid,
        { userAvatarProfile: null },
        { merge: true }
      );
      writeCachedUserAvatarProfile(null, uid);
    },
  };
};

export const userAvatarProfileService = createUserAvatarProfileService();
