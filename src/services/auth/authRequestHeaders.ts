import { defaultAuthRuntime } from '@/services/firebase-runtime/authRuntime';

export const resolveCurrentUserBearerToken = async (): Promise<string | null> => {
  await defaultAuthRuntime.ready;

  const currentUser = defaultAuthRuntime.getCurrentUser();
  if (!currentUser || currentUser.isAnonymous) {
    return null;
  }

  return currentUser.getIdToken();
};

export const resolveCurrentUserAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await resolveCurrentUserBearerToken();
  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};
