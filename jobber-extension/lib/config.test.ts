import { beforeEach, describe, expect, it } from "vitest";
import { installFakeChrome } from "./testing/fakeChrome";
import { DEFAULT_CONFIG, getConfig, setConfig } from "./config.js";

describe("config", () => {
  beforeEach(() => {
    installFakeChrome();
  });

  it("falls back to the localhost defaults", async () => {
    expect(await getConfig()).toEqual(DEFAULT_CONFIG);
  });

  it("merges a partial patch over the defaults", async () => {
    await setConfig({ apiBase: "http://192.168.1.4:8000" });

    const config = await getConfig();
    expect(config.apiBase).toBe("http://192.168.1.4:8000");
    expect(config.appBase).toBe(DEFAULT_CONFIG.appBase);
  });

  it("strips trailing slashes so path joins never double up", async () => {
    await setConfig({ apiBase: "http://localhost:9000///" });
    expect((await getConfig()).apiBase).toBe("http://localhost:9000");
  });

  it("ignores blank values rather than storing an unusable base", async () => {
    await setConfig({ apiBase: "   " });
    expect((await getConfig()).apiBase).toBe(DEFAULT_CONFIG.apiBase);
  });
});
