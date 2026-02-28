const BOT_SERVER_URL = (() => {
  const envUrl = import.meta.env.VITE_WHATSAPP_BOT_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  if (!import.meta.env.DEV) {
    return '/.netlify/functions/whatsapp-proxy';
  }

  return 'http://localhost:3001';
})();

export const buildBotUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${BOT_SERVER_URL}${normalizedPath}`;
};

export async function fetchBotJson(path: string, init?: RequestInit): Promise<Response> {
  return fetch(buildBotUrl(path), init);
}
