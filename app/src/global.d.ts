export {};

type EtatMaj =
  | { etat: 'desactive' } | { etat: 'verification' }
  | { etat: 'a_jour'; version: string } | { etat: 'disponible'; version: string }
  | { etat: 'telechargee'; version: string } | { etat: 'erreur'; message: string };

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
      /** Version de l'application installée (Electron uniquement). */
      version?: () => Promise<string>;
      /** Mises à jour automatiques (electron-updater, cf. electron/updater.ts). */
      majEtat?: () => Promise<EtatMaj>;
      majVerifier?: () => Promise<EtatMaj>;
      majInstaller?: () => Promise<boolean>;
      onMaj?: (cb: (etat: EtatMaj) => void) => () => void;
    };
  }
}
