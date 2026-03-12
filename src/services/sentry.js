/**
 * Sentry SDK initialization for FusionOps 3.0
 * 
 * DSN from: https://sentry.io → Projects → FusionOps → Settings → Client Keys
 */
import * as Sentry from "@sentry/react";

// Astro uses PUBLIC_ prefix for client-side env (not VITE_)
const DSN = import.meta.env.PUBLIC_SENTRY_DSN || import.meta.env.VITE_SENTRY_DSN || "";
const IS_DEV = import.meta.env.DEV;

if (DSN) {
    Sentry.init({
        dsn: DSN,
        sendDefaultPii: true,
        environment: IS_DEV ? "development" : "production",
        release: `fusionops@${import.meta.env.VITE_APP_VERSION || "2.2.0"}`,

        // Performance: sample 20% in prod, 100% in dev
        tracesSampleRate: IS_DEV ? 1.0 : 0.2,

        // Session Replay
        replaysSessionSampleRate: IS_DEV ? 0 : 0.1,
        replaysOnErrorSampleRate: 1.0,

        enabled: !IS_DEV || !!(import.meta.env.PUBLIC_SENTRY_DEV || import.meta.env.VITE_SENTRY_DEV),

        ignoreErrors: [
            "ResizeObserver loop",
            "Non-Error promise rejection captured",
            /Loading chunk \d+ failed/,
        ],

        beforeSend(event) {
            if (event.breadcrumbs) {
                event.breadcrumbs = event.breadcrumbs.map(b => {
                    if (b.data?.url) {
                        b.data.url = b.data.url.replace(/token=[^&]+/g, "token=***");
                    }
                    return b;
                });
            }
            return event;
        },
    });

    console.log(`[Sentry] ✅ Initialized (${IS_DEV ? "dev" : "prod"})`);
} else {
    console.log("[Sentry] ⏭ No DSN configured — skipping");
}

/**
 * Set user/app context after boot
 */
export function setSentryContext({ neonOk, apiOk, settingsKeys }) {
    if (!DSN) return;
    Sentry.setContext("app_state", { neonOk, apiOk, settingsKeys: settingsKeys || [] });
}

/**
 * Capture exception with extra context
 */
export function captureError(error, context = {}) {
    if (!DSN) return;
    Sentry.withScope(scope => {
        if (context.component) scope.setTag("component", context.component);
        if (context.action) scope.setTag("action", context.action);
        if (context.extra) scope.setExtras(context.extra);
        Sentry.captureException(error);
    });
}

/**
 * Add breadcrumb for manual tracking
 */
export function addBreadcrumb(category, message, data = {}) {
    if (!DSN) return;
    Sentry.addBreadcrumb({ category, message, data, level: "info" });
}

export { Sentry };
