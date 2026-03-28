import {
  getFirebaseStartupWarningCopy,
  type FirebaseStartupWarningCopy,
} from './firebaseStartupUiPolicy';
import { createScopedLogger } from '@/services/utils/loggerScope';

const firebaseStartupWarningLogger = createScopedLogger('FirebaseStartupWarningRenderer');

const highlightEnvToken = (step: string) =>
  step
    .replaceAll('VITE_FIREBASE_API_KEY', '<code>VITE_FIREBASE_API_KEY</code>')
    .replaceAll('VITE_FIREBASE_API_KEY_B64', '<code>VITE_FIREBASE_API_KEY_B64</code>')
    .replaceAll('VITE_FIREBASE_AUTH_DOMAIN', '<code>VITE_FIREBASE_AUTH_DOMAIN</code>')
    .replaceAll('VITE_FIREBASE_PROJECT_ID', '<code>VITE_FIREBASE_PROJECT_ID</code>')
    .replaceAll('VITE_FIREBASE_APP_ID', '<code>VITE_FIREBASE_APP_ID</code>');

export const mountFirebaseConfigWarning = (
  message: string,
  warningCopy?: FirebaseStartupWarningCopy
) => {
  firebaseStartupWarningLogger.warn(message);

  if (typeof document === 'undefined') return;
  const root = document.getElementById('root');
  if (!root) return;

  const resolvedWarningCopy = warningCopy || getFirebaseStartupWarningCopy();

  root.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;color:#0f172a;">
            <div style="max-width:520px;padding:24px;border-radius:12px;background:white;box-shadow:0 10px 40px rgba(15,23,42,0.12);font-family:Inter,sans-serif;">
                <h1 style="font-size:20px;font-weight:700;margin:0 0 12px 0;">${resolvedWarningCopy.title}</h1>
                <p style="margin:0 0 8px 0;line-height:1.5;">${resolvedWarningCopy.summary}</p>
                <ol style="margin:0 0 12px 20px;line-height:1.5;">
                    ${resolvedWarningCopy.steps.map(step => `<li>${highlightEnvToken(step)}</li>`).join('')}
                </ol>
                <p style="margin:0;color:#475569;font-size:14px;">${resolvedWarningCopy.footnote}</p>
            </div>
        </div>
    `;
};
