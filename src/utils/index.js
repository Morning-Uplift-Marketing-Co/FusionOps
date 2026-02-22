// Simple logging utility
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

export const LS = {
    get(k) {
        try {
            const item = localStorage.getItem("lpf2-" + k);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            logger.warn(`Failed to get "${k}":`, e.message);
            return null;
        }
    },
    set(k, v) {
        try {
            localStorage.setItem("lpf2-" + k, JSON.stringify(v));
            return true;
        } catch (e) {
            // Log quota exceeded or other storage errors
            logger.error(`Failed to save "${k}":`, e.message);
            return false;
        }
    },
    remove(k) {
        try {
            localStorage.removeItem("lpf2-" + k);
            return true;
        } catch (e) {
            logger.warn(`Failed to remove "${k}":`, e.message);
            return false;
        }
    },
    // Clear all LP Factory data (useful for logout)
    clear() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith("lpf2-")) {
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
