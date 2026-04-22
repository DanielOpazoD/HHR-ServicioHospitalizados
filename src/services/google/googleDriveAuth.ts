import { recordOperationalErrorTelemetry } from '@/services/observability/operationalTelemetryOutcomeRecorder';

interface TokenClient {
  requestAccessToken: () => void;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  error?: unknown;
}

const GOOGLE_GSI_SCRIPT_ID = 'google-identity-services';
const GOOGLE_GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const DRIVE_SCOPES =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly';

let accessToken: string | null = null;
let tokenExpiry = 0;
let googleScriptLoadPromise: Promise<void> | null = null;

const isTokenValid = (): boolean => Boolean(accessToken && Date.now() < tokenExpiry);

const isGoogleIdentityServicesReady = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.google?.accounts?.oauth2?.initTokenClient === 'function';

const loadGoogleIdentityServicesScript = async (): Promise<void> => {
  if (isGoogleIdentityServicesReady()) {
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Google Identity Services is only available in browser environments.');
  }

  if (!googleScriptLoadPromise) {
    googleScriptLoadPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.getElementById(
        GOOGLE_GSI_SCRIPT_ID
      ) as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener(
          'error',
          () => reject(new Error('Failed to load Google Identity Services script.')),
          { once: true }
        );
        return;
      }

      const script = document.createElement('script');
      script.id = GOOGLE_GSI_SCRIPT_ID;
      script.src = GOOGLE_GSI_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services script.'));
      document.head.appendChild(script);
    }).finally(() => {
      if (!isGoogleIdentityServicesReady()) {
        googleScriptLoadPromise = null;
      }
    });
  }

  await googleScriptLoadPromise;

  if (!isGoogleIdentityServicesReady()) {
    throw new Error('Google Identity Services script not loaded.');
  }
};

export const isGoogleDriveEditingConfigured = (): boolean => Boolean(GOOGLE_CLIENT_ID);

export const requestAccessToken = async (): Promise<string> => {
  if (isTokenValid()) {
    return accessToken!;
  }

  if (!GOOGLE_CLIENT_ID) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is not configured.');
  }

  await loadGoogleIdentityServicesScript();

  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPES,
        callback: response => {
          if (response.error) {
            reject(
              recordOperationalErrorTelemetry(
                'integration',
                'google_drive_request_access_token',
                response.error,
                {
                  code: 'google_drive_auth_failed',
                  message: 'Google Drive auth returned an error.',
                  severity: 'error',
                  userSafeMessage: 'No fue posible autorizar Google Drive.',
                }
              )
            );
            return;
          }

          accessToken = response.access_token;
          tokenExpiry = Date.now() + (response.expires_in || 3600) * 1000;
          resolve(accessToken!);
        },
      });

      client.requestAccessToken();
    } catch (error) {
      reject(
        recordOperationalErrorTelemetry('integration', 'google_drive_init_token_client', error, {
          code: 'google_drive_token_client_init_failed',
          message: 'Failed to initialize Google Drive token client.',
          severity: 'error',
          userSafeMessage: 'No fue posible iniciar la autenticación de Google Drive.',
        })
      );
    }
  });
};
