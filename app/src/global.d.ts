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
    };
  }
}
