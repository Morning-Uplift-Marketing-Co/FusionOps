// Simple logging utility
import { resolveD1DatabaseIds, sanitizeSettings } from '../services/account-lock.js';

function healSettingsIfNeeded(raw) {
    if (!raw || typeof raw !== 'object') return raw;
    const resolved = resolveD1DatabaseIds(raw);
    const stale =
        (raw.d1DatabaseId && resolved.d1DatabaseId && raw.d1DatabaseId !== resolved.d1DatabaseId) ||
        (raw.cfD1DatabaseId && resolved.cfD1DatabaseId && raw.cfD1DatabaseId !== resolved.cfD1DatabaseId);
    if (!stale) return sanitizeSettings(raw);
    return sanitizeSettings({
        ...raw,
        d1DatabaseId: resolved.d1DatabaseId,
        cfD1DatabaseId: resolved.cfD1DatabaseId,
    });
}

function writeStorageKeys(k, serialized) {
    localStorage.setItem(STORAGE_PREFIX + k, serialized);
    localStorage.setItem(LEGACY_PREFIX + k, serialized);
}

const logger = {
    warn: (msg, ...args) => {
        if (import.meta.env?.DEV) {
            console.warn(`[LS] ${msg}`, ...args);
        }
    },
    error: (msg, ...args) => {
        console.error(`[LS] ${msg}`, ...args);
    }
};

function getStoragePrefix() {
    try {
        if (typeof window !== "undefined" && window.location) {
            const host = `${window.location.hostname}${window.location.port ? `:${window.location.port}` : ""}`;
            return `lpf2:${host}:`;
        }
    } catch (_e) {
    }
    return "lpf2:";
}

const STORAGE_PREFIX = getStoragePrefix();
const LEGACY_PREFIX = "lpf2-";

export const LS = {
    get(k) {
        try {
            const item = localStorage.getItem(STORAGE_PREFIX + k) ?? localStorage.getItem(LEGACY_PREFIX + k);
            if (!item) return null;
            const parsed = JSON.parse(item);
            if (k !== 'settings') return parsed;
            const healed = healSettingsIfNeeded(parsed);
            if (JSON.stringify(healed) !== JSON.stringify(parsed)) {
                try {
                    writeStorageKeys(k, JSON.stringify(healed));
                } catch (_e) { /* quota */ }
            }
            return healed;
        } catch (e) {
            logger.warn(`Failed to get "${k}":`, e.message);
            return null;
        }
    },
    set(k, v) {
        try {
            const value = k === 'settings' ? healSettingsIfNeeded(v) : v;
            const serialized = JSON.stringify(value);
            // Keep both namespaced and legacy keys in sync for backward compatibility.
            writeStorageKeys(k, serialized);
            return true;
        } catch (e) {
            // Log quota exceeded or other storage errors
            logger.error(`Failed to save "${k}":`, e.message);
            return false;
        }
    },
    remove(k) {
        try {
            localStorage.removeItem(STORAGE_PREFIX + k);
            localStorage.removeItem(LEGACY_PREFIX + k);
            return true;
        } catch (e) {
            logger.warn(`Failed to remove "${k}":`, e.message);
            return false;
        }
    },
    // Clear all FusionOps data (useful for logout)
    clear() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(STORAGE_PREFIX) || key.startsWith(LEGACY_PREFIX)) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (e) {
            logger.error("Failed to clear storage:", e.message);
            return false;
        }
    }
};

export function uid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    }
    // Fallback for environments without crypto.randomUUID
    return (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).slice(0, 16);
}

export function now() {
    return new Date().toISOString();
}

export function hsl(h, s, l) {
    return `hsl(${h},${s}%,${l}%)`;
}
