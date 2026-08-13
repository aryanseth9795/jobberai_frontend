const AUTH_KEY = "jobber_auth";
const USER_KEY = "jobber_user";

export async function getTokens() {
  const stored = await chrome.storage.local.get(AUTH_KEY);
  return stored[AUTH_KEY] || null;
}

// Stores only the two fields the extension uses. The login response also
// carries token_type; keeping it would mean a second thing to keep in sync
// with the backend for no benefit.
export async function setTokens(pair) {
  await chrome.storage.local.set({
    [AUTH_KEY]: {
      access_token: pair.access_token,
      refresh_token: pair.refresh_token,
    },
  });
}

// Clears the cached user alongside the tokens: leaving an email behind would
// show a signed-out popup with somebody's account chip still in the header.
export async function clearTokens() {
  await chrome.storage.local.remove([AUTH_KEY, USER_KEY]);
}

export async function getUser() {
  const stored = await chrome.storage.local.get(USER_KEY);
  return stored[USER_KEY] || null;
}

export async function setUser(user) {
  await chrome.storage.local.set({ [USER_KEY]: { email: user.email } });
}
