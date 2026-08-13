// An in-memory stand-in for chrome.storage.local, so the lib modules can be
// tested under Vitest's jsdom environment where no `chrome` global exists.

interface FakeStorageArea {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

interface FakeChrome {
  storage: { local: FakeStorageArea };
}

export function installFakeChrome(): { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();

  const local: FakeStorageArea = {
    async get(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const key of list) {
        if (store.has(key)) out[key] = store.get(key);
      }
      return out;
    },
    async set(items) {
      for (const [key, value] of Object.entries(items)) store.set(key, value);
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const key of list) store.delete(key);
    },
  };

  (globalThis as unknown as { chrome: FakeChrome }).chrome = { storage: { local } };
  return { store };
}
