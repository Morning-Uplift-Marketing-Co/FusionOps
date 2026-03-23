/**
 * Auth Service — FusionOps 3.0
 *
 * PBKDF2 password hashing (Web Crypto API, browser-native)
 * Session token stored in localStorage (SPA compromise — no httpOnly possible from browser)
 * All user/session data stored in Neon via neon.js DB layer
 */

import * as db from "./neon";
import { uid } from "../utils";

const SESSION_KEY = "lpf2-session";
const SESSION_TTL_DAYS = 365; // 1 year - remember login longer

/* ═══════════════════════════════════════════════════
   CRYPTO HELPERS
═══════════════════════════════════════════════════ */

async function pbkdf2Hash(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPassword(password) {
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hash = await pbkdf2Hash(password, salt);
  return `${salt}:${hash}`;
}

export async function verifyPassword(password, storedHash) {
  const [salt, expected] = (storedHash || "").split(":");
  if (!salt || !expected) return false;
  try {
    const actual = await pbkdf2Hash(password, salt);
    return actual === expected;
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════════════
   SESSION STORAGE (localStorage)
═══════════════════════════════════════════════════ */

function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function storeSession(token, user) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      token,
      user,
      exp: Date.now() + SESSION_TTL_DAYS * 86_400_000,
    })
  );
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY);
}

/* ═══════════════════════════════════════════════════
   PUBLIC API
═══════════════════════════════════════════════════ */

/**
 * Login with email + password.
 * @returns {{ ok: boolean, user?: object, error?: string }}
 */
export async function login(email, password) {
  if (!email || !password) return { ok: false, error: "Email and password required" };

  let user;
  try {
    user = await db.findUserByEmail(email.trim().toLowerCase());
  } catch (e) {
    return { ok: false, error: "Database connection error. Check Neon settings." };
  }

  if (!user) return { ok: false, error: "Invalid email or password" };
  if (!user.is_active) return { ok: false, error: "Account is inactive. Contact your admin." };

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return { ok: false, error: "Invalid email or password" };

  // Generate random 256-bit token (single call)
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000).toISOString();
  const sessionId = "s_" + token.slice(0, 16);

  try {
    await Promise.all([
      db.createSession({ id: sessionId, userId: user.id, token, expiresAt, ua: navigator.userAgent.slice(0, 200) }),
      db.updateLastLogin(user.id),
    ]);
  } catch (e) {
    // Continue even if session save fails — degrade gracefully
    console.warn("[auth] Session save failed:", e.message);
  }

  const safeUser = { id: user.id, email: user.email, role: user.role, name: user.name || user.email.split("@")[0] };
  storeSession(token, safeUser);

  return { ok: true, user: safeUser };
}

/**
 * Logout — clear local session + delete from DB.
 */
export async function logout() {
  const session = getStoredSession();
  if (session?.token) {
    db.deleteSession(session.token).catch(() => {});
  }
  clearStoredSession();
}

/**
 * Check current session — returns user or null.
 * Verifies token against DB if Neon is available.
 */
export async function getMe() {
  const session = getStoredSession();
  if (!session) return null;

  // Check local expiry
  if (session.exp && session.exp < Date.now()) {
    clearStoredSession();
    return null;
  }

  // Try to verify against DB (soft check — if DB fails, trust localStorage)
  try {
    // If Neon is not yet initialized (race on boot), trust local session
    if (!db.getConnectionStatus().connected) return session.user;

    const dbSession = await db.findSession(session.token);
    if (!dbSession) {
      clearStoredSession();
      return null;
    }
    if (new Date(dbSession.expires_at) < new Date()) {
      clearStoredSession();
      db.deleteSession(session.token).catch(() => {});
      return null;
    }
  } catch {
    // Neon unavailable — trust local session
    console.warn("[auth] DB session check failed — using local session");
  }

  return session.user;
}

/**
 * Register a new user (admin-only action).
 * @returns {{ ok: boolean, user?: object, error?: string }}
 */
export async function register(email, password, role = "employee", name = "") {
  if (!email || !password) return { ok: false, error: "Email and password required" };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters" };

  const passwordHash = await hashPassword(password);
  const id = "u_" + uid();

  try {
    await db.createUser({ id, email: email.trim().toLowerCase(), passwordHash, role, name });
    return { ok: true, user: { id, email, role, name } };
  } catch (e) {
    if (e.message?.includes("unique") || e.message?.includes("duplicate") || e.message?.includes("already exists")) {
      return { ok: false, error: "Email already registered" };
    }
    return { ok: false, error: e.message || "Failed to create user" };
  }
}

/**
 * Check if any users exist in the database.
 * Used to detect first-run / bootstrap state.
 * @returns {Promise<boolean>} true = at least one user exists
 */
export async function checkUsersExist() {
  try {
    const users = await db.loadUsers();
    return Array.isArray(users) && users.length > 0;
  } catch {
    // DB not ready — assume exists to avoid false setup page
    return true;
  }
}

/**
 * Seed the very first admin account (only works when users table is empty).
 * @returns {{ ok: boolean, user?: object, error?: string }}
 */
export async function seedFirstAdmin(email, password, name = "") {
  const exists = await checkUsersExist();
  if (exists) return { ok: false, error: "Setup already complete. Use the login form." };
  return register(email, password, "admin", name || email.split("@")[0]);
}

/**
 * Auto-refresh session to extend TTL if user is active.
 * Call this periodically to keep session alive.
 */
export async function refreshSession() {
  const session = getStoredSession();
  if (!session) return false;

  // Only refresh if less than 30 days remaining
  const thirtyDaysMs = 30 * 86_400_000;
  if (session.exp - Date.now() > thirtyDaysMs) return true;

  try {
    // Update local expiry
    const newExp = Date.now() + SESSION_TTL_DAYS * 86_400_000;
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        ...session,
        exp: newExp,
      })
    );

    // Update DB expiry if available
    if (db.getConnectionStatus().connected) {
      await db.updateSessionExpiry(session.token, new Date(newExp).toISOString());
    }

    console.log("[auth] Session refreshed");
    return true;
  } catch (e) {
    console.warn("[auth] Failed to refresh session:", e);
    return false;
  }
}

/**
 * Change password for a user (admin can do any, employee their own).
 */
export async function updatePassword(userId, newPassword) {
  if (newPassword.length < 8) return { ok: false, error: "Password must be at least 8 characters" };
  const passwordHash = await hashPassword(newPassword);
  try {
    await db.updateUserPassword(userId, passwordHash);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ═══════════════════════════════════════════════════
   ROLE HELPERS
═══════════════════════════════════════════════════ */

export const SENSITIVE_KEYS = new Set(["revenue", "profit", "netProfit", "grossProfit", "roi", "payout"]);

/**
 * Strip financial fields from an object/array (for employee role).
 */
export function sanitizeForEmployee(input) {
  if (Array.isArray(input)) return input.map(sanitizeForEmployee);
  if (!input || typeof input !== "object") return input;
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (SENSITIVE_KEYS.has(k)) continue;
    out[k] = sanitizeForEmployee(v);
  }
  return out;
}

export function isAdmin(user) {
  const role = String(
    user?.role
    ?? user?.user_role
    ?? user?.type
    ?? ""
  ).trim().toLowerCase();

  if (user?.is_admin === true || user?.isAdmin === true) return true;
  return role === "admin" || role === "superadmin" || role === "owner";
}

export function isEmployee(user) {
  return user?.role === "employee";
}
