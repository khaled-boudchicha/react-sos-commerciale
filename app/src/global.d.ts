export {};

declare global {
  interface Window {
    gc: {
      store: {
        get: (key: string) => Promise<unknown>;
        set: (key: string, value: unknown) => Promise<void>;
        delete: (key: string) => Promise<void>;
      };
      platform: string;
      /** Liste des imprimantes système (Electron uniquement). */
      printers?: () => Promise<{ name: string; displayName?: string; isDefault?: boolean }[]>;
      /** Impression silencieuse d'un HTML complet vers une imprimante (Electron uniquement). */
      printSilent?: (html: string, opts?: { deviceName?: string; silent?: boolean }) => Promise<{ success: boolean; reason?: string }>;
    };
  }
}
