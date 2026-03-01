/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_LOCAL_GEMINI_API_KEY?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_API_KEY?: string;
  readonly VITE_E2E_MODE?: string;
  readonly VITE_ALLOW_DEV_EMAIL_SEND?: string;
  readonly VITE_CENSUS_EMAIL_ENDPOINT?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface _ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    __HHR_E2E_OVERRIDE__?: Record<string, import('./types').DailyRecord>;
  }
}

export {};
