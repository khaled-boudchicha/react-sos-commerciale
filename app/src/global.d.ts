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
      /** Modèles d'impression .gcr (fichiers dans Documents/Gestion Commerciale/Modeles) — Electron uniquement. */
      modeles?: {
        dossier: () => Promise<string>;
        liste: () => Promise<{ file: string; name: string; kind: string; description?: string; modified: string; size: number }[]>;
        lire: (file: string) => Promise<string | null>;
        ecrire: (file: string, contenu: string) => Promise<{ ok: boolean; raison?: string }>;
        supprimer: (file: string) => Promise<boolean>;
        importer: () => Promise<{ nom: string; contenu: string }[]>;
        exporter: (nom: string, contenu: string) => Promise<string | null>;
        ouvrirDossier: () => Promise<void>;
        pdf: (html: string, largeurMm: number, hauteurMm: number, nom: string) => Promise<string | null>;
      };
      /** Protection locale de la session : chiffrement au repos (trousseau de l'OS) disponible ? */
      securite?: () => Promise<{ chiffrement: boolean; plateforme: string; moteur?: string } | null>;
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
