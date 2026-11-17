/**
 * Detects and communicates with the Syslab Lab HHR Chrome extension.
 *
 * The extension content script sets `document.body.dataset.syslabExt = '1'`
 * when it loads on this page, and fires `syslab:extensionReady` for late-loading cases.
 *
 * Call `openInExtension(patients)` to hand off a patient list to the popup.
 */

export interface ExtensionPatient {
  rut: string;
  patientName: string;
  bedId?: string;
  label?: string;
}

/** Returns true if the Syslab Chrome extension is installed and active on this page. */
export const isSyslabExtensionAvailable = (): boolean =>
  document.body.dataset.syslabExt === '1';

/**
 * Subscribe to the extension becoming available (handles race where content
 * script loads after the React tree mounts).
 */
export const onSyslabExtensionReady = (callback: () => void): (() => void) => {
  if (isSyslabExtensionAvailable()) {
    callback();
    return () => {};
  }
  const handler = () => callback();
  window.addEventListener('syslab:extensionReady', handler);
  return () => window.removeEventListener('syslab:extensionReady', handler);
};

/**
 * Send a patient list to the extension and open the Syslab popup.
 * The extension stores the patients and opens its popup window.
 */
export const openInExtension = (patients: ExtensionPatient[]): void => {
  window.dispatchEvent(
    new CustomEvent('syslab:abrir', {
      detail: { patients },
    })
  );
};
