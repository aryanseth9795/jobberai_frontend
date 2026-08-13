// The extension's error taxonomy. Each type maps to a distinct popup state,
// which is what replaces the old `Backend error: ${status}` string.

export class AuthExpired extends Error {
  constructor(message = "Your session has expired. Sign in again.") {
    super(message);
    this.name = "AuthExpired";
  }
}

export class SetupIncomplete extends Error {
  constructor(steps = []) {
    super("Your JobberAI account setup isn't finished yet.");
    this.name = "SetupIncomplete";
    this.steps = steps;
  }
}

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `The server rejected the request (${status}).`);
    this.name = "ApiError";
    this.status = status;
  }
}

export class NetworkError extends Error {
  constructor(apiBase) {
    super(`Can't reach JobberAI at ${apiBase}. Check the backend is running.`);
    this.name = "NetworkError";
    this.apiBase = apiBase;
  }
}

// Structured-clone-safe shape for chrome.runtime message responses: Error
// instances do not survive the message channel, so send this instead.
export function toWireError(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || "Something went wrong.",
    steps: error?.steps || [],
    status: error?.status,
  };
}
