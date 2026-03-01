interface TokenClient {
  requestAccessToken: () => void;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  error?: unknown;
}

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
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file';

let accessToken: string | null = null;
let tokenExpiry = 0;

const isTokenValid = (): boolean => Boolean(accessToken && Date.now() < tokenExpiry);

export const isGoogleDriveEditingConfigured = (): boolean => Boolean(GOOGLE_CLIENT_ID);

export const requestAccessToken = (): Promise<string> =>
  new Promise((resolve, reject) => {
    if (isTokenValid()) {
      resolve(accessToken!);
      return;
    }

    if (!GOOGLE_CLIENT_ID) {
      reject(new Error('VITE_GOOGLE_CLIENT_ID is not configured.'));
      return;
    }

    if (!window.google) {
      reject(new Error('Google Identity Services script not loaded.'));
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPES,
        callback: response => {
          if (response.error) {
            console.error('[GoogleDrive] Auth error:', response.error);
            reject(response.error);
            return;
          }

          accessToken = response.access_token;
          tokenExpiry = Date.now() + (response.expires_in || 3600) * 1000;
          resolve(accessToken!);
        },
      });

      client.requestAccessToken();
    } catch (error) {
      console.error('[GoogleDrive] Failed to initialize token client:', error);
      reject(error);
    }
  });
