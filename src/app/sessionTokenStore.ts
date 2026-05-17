const SESSION_TOKEN_KEY = "guess-wrod.session-token";

export function readSessionToken(): string | null {
  try {
    return window.localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeSessionToken(token: string): void {
  window.localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken(): void {
  window.localStorage.removeItem(SESSION_TOKEN_KEY);
}
