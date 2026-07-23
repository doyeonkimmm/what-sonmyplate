import { env } from "cloudflare:workers";

const enc = new TextEncoder();
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const unb64 = (value: string) => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
const secret = () => String((env as unknown as { SESSION_SECRET?: string }).SESSION_SECRET || "local-development-secret-change-me");

async function hmac(value: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(value))));
}

export type AppUser = { id: string; username: string; email: string; displayName: string };

export async function makeSession(user: AppUser, ttlMs = 1000 * 60 * 60 * 24 * 30) {
  const payload = b64(enc.encode(JSON.stringify({ ...user, exp: Date.now() + ttlMs })));
  return `${payload}.${await hmac(payload)}`;
}

export async function readSession(cookie: string | null): Promise<AppUser | null> {
  const token = cookie?.match(/(?:^|;\s*)plate_session_v3=([^;]+)/)?.[1];
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || await hmac(payload) !== signature) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(unb64(payload)));
    if (data.exp < Date.now()) return null;
    return { id: data.id, username: data.username, email: data.email, displayName: data.displayName };
  } catch { return null; }
}

export async function hashPassword(password: string, salt = b64(crypto.getRandomValues(new Uint8Array(16)))) {
  const material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unb64(salt), iterations: 60000 }, material, 256);
  return { salt, hash: b64(new Uint8Array(bits)) };
}

export const sessionCookie = (token: string, maxAge = 2592000) =>
  `plate_session_v3=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
