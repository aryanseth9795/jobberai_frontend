import { beforeEach, describe, expect, it } from "vitest";
import { installFakeChrome } from "./testing/fakeChrome";
import { clearTokens, getTokens, getUser, setTokens, setUser } from "./tokens.js";

describe("tokens", () => {
  beforeEach(() => {
    installFakeChrome();
  });

  it("returns null when nothing is stored", async () => {
    expect(await getTokens()).toBeNull();
  });

  it("round-trips a token pair", async () => {
    await setTokens({ access_token: "a", refresh_token: "r" });
    expect(await getTokens()).toEqual({ access_token: "a", refresh_token: "r" });
  });

  it("stores only the two token fields", async () => {
    await setTokens({ access_token: "a", refresh_token: "r", token_type: "bearer" });
    expect(Object.keys((await getTokens()) as object).sort()).toEqual([
      "access_token",
      "refresh_token",
    ]);
  });

  it("clearTokens removes the cached user too", async () => {
    await setTokens({ access_token: "a", refresh_token: "r" });
    await setUser({ email: "a@example.com" });

    await clearTokens();

    expect(await getTokens()).toBeNull();
    expect(await getUser()).toBeNull();
  });
});
