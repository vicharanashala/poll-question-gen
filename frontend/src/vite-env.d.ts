/// <reference types="vite/client" />

// Declare the virtual pwa-register module
declare module 'virtual:pwa-register' {
  export function registerSW(options?: any): (reloadPage?: boolean) => void;
}
