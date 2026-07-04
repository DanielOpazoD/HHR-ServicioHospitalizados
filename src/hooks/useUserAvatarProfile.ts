import { useCallback, useEffect, useState } from 'react';
import type { AuthUser } from '@/types/authRoleTypes';
import {
  readCachedUserAvatarProfile,
  userAvatarProfileService,
  type UserAvatarProfile,
} from '@/services/user-profile/userAvatarProfileService';

export interface UseUserAvatarProfileResult {
  profile: UserAvatarProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  uploadAvatar: (file: File) => Promise<UserAvatarProfile>;
  removeAvatar: () => Promise<void>;
  clearError: () => void;
}

const resolveErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'No se pudo actualizar la foto de perfil.';

export const useUserAvatarProfile = (
  user: AuthUser | null | undefined
): UseUserAvatarProfileResult => {
  const [profile, setProfile] = useState<UserAvatarProfile | null>(() =>
    readCachedUserAvatarProfile(user?.uid)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const uid = user?.uid?.trim();
    if (!uid) {
      setProfile(null);
      setIsLoading(false);
      return undefined;
    }

    setProfile(readCachedUserAvatarProfile(uid));
    setIsLoading(true);
    setError(null);
    const unsubscribe = userAvatarProfileService.subscribeProfile(
      uid,
      nextProfile => {
        setProfile(nextProfile);
        setIsLoading(false);
      },
      subscriptionError => {
        setError(resolveErrorMessage(subscriptionError));
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [user?.uid]);

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!user?.uid) {
        throw new Error('No se pudo identificar al usuario actual.');
      }

      setIsSaving(true);
      setError(null);
      try {
        const nextProfile = await userAvatarProfileService.uploadAvatar({
          uid: user.uid,
          email: user.email,
          file,
        });
        setProfile(nextProfile);
        return nextProfile;
      } catch (uploadError) {
        const message = resolveErrorMessage(uploadError);
        setError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [user?.email, user?.uid]
  );

  const removeAvatar = useCallback(async () => {
    if (!user?.uid) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await userAvatarProfileService.removeAvatar(user.uid);
      setProfile(null);
    } catch (removeError) {
      const message = resolveErrorMessage(removeError);
      setError(message);
      throw new Error(message);
    } finally {
      setIsSaving(false);
    }
  }, [user?.uid]);

  return {
    profile,
    isLoading,
    isSaving,
    error,
    uploadAvatar,
    removeAvatar,
    clearError: () => setError(null),
  };
};
