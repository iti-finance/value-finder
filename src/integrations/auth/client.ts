import { AUTH_TOKEN_KEY } from "./constants";

/**
 * Returns the JWT stored in localStorage.
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_KEY)?.trim() ?? null;
}

/**
 * Stores the JWT in localStorage.
 */
export function setAuthToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_KEY, token.trim());
}

/**
 * Removes the JWT from localStorage.
 */
export function clearAuthToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Decodes a Base64URL string.
 */
function base64UrlDecode(value: string): string | null {
  let base64 = value.replace(/-/g, "+").replace(/_/g, "/");

  const padding = base64.length % 4;

  if (padding === 2) {
    base64 += "==";
  } else if (padding === 3) {
    base64 += "=";
  } else if (padding === 1) {
    return null;
  }

  try {
    if (typeof atob === "function") {
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));

      return new TextDecoder().decode(bytes);
    }
  } catch {
    // Ignore and fall back to Buffer
  }

  try {
    const buffer = Buffer.from(base64, "base64");
    return buffer.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Decodes the payload of a JWT without verifying its signature.
 * Use only for reading client-side claims (e.g. expiry, username).
 */
export function decodeJwtPayload<T = unknown>(token: string): T | null {
  const parts = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const payload = base64UrlDecode(parts[1]);

  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}
