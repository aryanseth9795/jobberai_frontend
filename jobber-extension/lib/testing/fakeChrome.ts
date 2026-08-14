// An in-memory stand-in for chrome.storage.local and the slice of chrome.tabs
// that lib/formState.js relies on, so the lib modules can be tested under
// Vitest's jsdom environment where no `chrome` global exists.

interface FakeStorageArea {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export interface FakeTab {
  id: number;
  url?: string;
  title?: string;
  active?: boolean;
}

interface FakeTabsArea {
  get(tabId: number): Promise<FakeTab>;
  query(queryInfo: Record<string, unknown>): Promise<FakeTab[]>;
}

interface FakeChrome {
  storage: { local: FakeStorageArea };
  tabs: FakeTabsArea;
}

export function installFakeChrome(): { store: Map<string, unknown>; tabs: Map<number, FakeTab> } {
  const store = new Map<string, unknown>();
  const tabs = new Map<number, FakeTab>();

  const local: FakeStorageArea = {
    async get(keys) {
      // Matches real chrome.storage.local.get: null/undefined returns
      // everything, used by clearAllFormStates to enumerate form_state_*
      // keys without knowing the tab ids in advance.
      if (keys === null || keys === undefined) {
        const out: Record<string, unknown> = {};
        for (const [key, value] of store) out[key] = value;
        return out;
      }
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

  const tabsArea: FakeTabsArea = {
    async get(tabId) {
      const tab = tabs.get(tabId);
      if (!tab) throw new Error(`No tab with id: ${tabId}`);
      return tab;
    },
    async query(queryInfo) {
      let list = [...tabs.values()];
      if (typeof queryInfo?.active === "boolean") {
        list = list.filter((tab) => Boolean(tab.active) === queryInfo.active);
      }
      return list;
    },
  };

  (globalThis as unknown as { chrome: FakeChrome }).chrome = {
    storage: { local },
    tabs: tabsArea,
  };
  return { store, tabs };
}
