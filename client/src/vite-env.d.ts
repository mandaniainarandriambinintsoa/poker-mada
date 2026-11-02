/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SOCKET_URL: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_ALLOW_LOCAL_REGISTRATION?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
