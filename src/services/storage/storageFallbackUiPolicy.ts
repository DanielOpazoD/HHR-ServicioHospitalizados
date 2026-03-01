const STORAGE_AUTO_RECOVERY_KEY = 'hhr_storage_auto_recovery_attempted_v1';

export type StorageFallbackUiCopy = {
  title: string;
  summary: string;
  detail: string;
  primaryActionLabel: string;
  advancedActionLabel: string;
};

export const getStorageAutoRecoveryKey = (): string => STORAGE_AUTO_RECOVERY_KEY;

export const hasAttemptedStorageAutoRecovery = (): boolean => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return false;
  }

  return window.sessionStorage.getItem(STORAGE_AUTO_RECOVERY_KEY) === 'true';
};

export const markStorageAutoRecoveryAttempted = (): void => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return;
  }

  window.sessionStorage.setItem(STORAGE_AUTO_RECOVERY_KEY, 'true');
};

export const clearStorageAutoRecoveryAttempt = (): void => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return;
  }

  window.sessionStorage.removeItem(STORAGE_AUTO_RECOVERY_KEY);
};

export const shouldAttemptStorageAutoRecovery = (isFallback: boolean): boolean =>
  isFallback && !hasAttemptedStorageAutoRecovery();

export const shouldShowStorageFallbackUi = (isFallback: boolean): boolean =>
  isFallback && hasAttemptedStorageAutoRecovery();

export const getStorageFallbackUiCopy = (): StorageFallbackUiCopy => ({
  title: 'Guardado local limitado',
  summary: 'La app sigue funcionando. Conviene recargar una vez para recuperar el guardado normal.',
  detail:
    'Esto suele pasar después de borrar los datos del sitio en el navegador. Normalmente se resuelve recargando la página una sola vez. Si el aviso reaparece varias veces seguidas, puedes reiniciar el guardado local de esta app.',
  primaryActionLabel: 'Recargar',
  advancedActionLabel: 'Reiniciar guardado local',
});
