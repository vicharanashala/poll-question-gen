/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Add type declarations for Vite's import.meta.env
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_APP_API_URL: string;
  // Add other environment variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Add type declarations for the PWA plugin
declare module 'vite-plugin-pwa' {
  interface VitePWAOptions {
    strategies?: 'generateSW' | 'injectManifest' | 'generateSW';
    registerType?: 'autoUpdate' | 'prompt' | 'auto';
    injectRegister?: 'auto' | 'inline' | 'script' | 'null' | false;
    includeManifestIcons?: boolean;
    useCredentials?: boolean;
    minify?: boolean;
    disable?: boolean;
    selfDestroying?: boolean;
    srcDir?: string;
    filename?: string;
    manifestFilename?: string;
    outDir?: string;
    // Add other PWA options as needed
  }
}

/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: any) => void;
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}

