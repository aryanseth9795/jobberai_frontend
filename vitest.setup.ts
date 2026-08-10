import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();

  // middleware.test.ts runs under the node environment, where there is no
  // document to clean up.
  if (typeof document === "undefined") return;

  // Cookies persist across tests in a shared jsdom document, so a token left
  // behind by one test would silently satisfy the next one's precondition.
  for (const part of document.cookie.split(";")) {
    const name = part.trim().split("=")[0];
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
});
