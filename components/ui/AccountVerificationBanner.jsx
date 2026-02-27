/**
 * Account Verification Banner Component
 *
 * Displays critical warnings when Cloudflare account mismatch is detected
 * Blocks deployment actions until account is corrected
 */

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { validateSettingsAccount, diagnoseLocalStorage, clearStaleAccountData, LOCKED_CF_ACCOUNT_ID, LOCKED_CF_API_TOKEN, LEGACY_CF_ACCOUNT_ID } from "../../services/account-lock";
import { api } from "../../services/api";

const S = {
  banner: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    padding: "16px 20px",
    background: "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)",
    color: "white",
    boxShadow: "0 4px 20px rgba(220, 38, 38, 0.4)",
    borderBottom: "2px solid #FCA5A5"
  },
  bannerHidden: {
    display: "none"
  },
  content: {
    maxWidth: "1400px",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px"
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flex: 1
  },
  icon: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  text: {
    flex: 1
  },
  title: {
    fontSize: "16px",
    fontWeight: 800,
    marginBottom: "4px",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  description: {
    fontSize: "13px",
    opacity: 0.95,
    lineHeight: "1.4"
  },
  details: {
    fontSize: "11px",
    fontFamily: "monospace",
    background: "rgba(0, 0, 0, 0.3)",
    padding: "6px 10px",
    borderRadius: "4px",
    marginTop: "6px",
    display: "inline-block"
  },
  actions: {
    display: "flex",
    gap: "8px",
    flexShrink: 0
  },
  button: {
    padding: "8px 16px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    border: "none",
    transition: "all 0.2s"
  },
  buttonPrimary: {
    background: "white",
    color: "#DC2626"
  },
  buttonSecondary: {
    background: "rgba(255, 255, 255, 0.15)",
    color: "white",
    border: "1px solid rgba(255, 255, 255, 0.3)"
  },
  closeButton: {
    width: "28px",
    height: "28px",
    borderRadius: "6px",
    background: "rgba(0, 0, 0, 0.3)",
    border: "none",
    color: "white",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  }
};

export function AccountVerificationBanner({ settings, onSettingsFixed, onDismiss }) {
  const [diagnosis, setDiagnosis] = useState(null);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState(null);

  useEffect(() => {
    if (settings?.cfAccountId) {
      const validation = validateSettingsAccount(settings);
      if (!validation.valid) {
        setDiagnosis(validation);
      } else {
        setDiagnosis(null);
      }
    }
  }, [settings]);

  // Also diagnose localStorage
  useEffect(() => {
    const localDiagnosis = diagnoseLocalStorage();
    if (localDiagnosis.issues?.length > 0) {
      setDiagnosis(prev => ({
        ...prev,
        localStorage: localDiagnosis
      }));
    }
  }, []);

  const handleFix = async () => {
    setFixing(true);
    setFixResult(null);

    try {
      // Option 1: Clear localStorage if it has stale data
      if (diagnosis?.localStorage?.issues?.length > 0) {
        const cleared = clearStaleAccountData();
        if (cleared) {
          setFixResult({ success: true, method: 'localStorage_cleared' });
          // Trigger page reload to apply clean state
          setTimeout(() => window.location.reload(), 1000);
          return;
        }
      }

      // Option 2: Update settings via API
      const payload = { cfAccountId: LOCKED_CF_ACCOUNT_ID };
      if (LOCKED_CF_API_TOKEN) payload.cfApiToken = LOCKED_CF_API_TOKEN;
      const response = await api.post("/settings", payload);

      if (response.ok) {
        setFixResult({ success: true, method: 'api_updated' });
        // Reload to get fresh settings
        setTimeout(() => window.location.reload(), 1000);
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (error) {
      setFixResult({
        success: false,
        error: error.message
      });
    } finally {
      setFixing(false);
    }
  };

  const handleDismiss = () => {
    onDismiss?.();
  };

  if (!diagnosis || !diagnosis.errors?.length > 0) {
    return null;
  }

  const hasCriticalError = diagnosis.errors.some(e => e.critical);
  const accountError = diagnosis.fields.cfAccountId;
  const isLegacyAccount = accountError?.legacy === LEGACY_CF_ACCOUNT_ID;

  return (
    <div style={diagnosis ? S.banner : S.bannerHidden}>
      <div style={S.content}>
        <div style={S.left}>
          <div style={S.icon}>
            {hasCriticalError ? "🚨" : "⚠️"}
          </div>
          <div style={S.text}>
            <div style={S.title}>
              {isLegacyAccount ? "LEGACY ACCOUNT DETECTED" : "Cloudflare Account Mismatch"}
            </div>
            <div style={S.description}>
              {isLegacyAccount
                ? "Critical security issue: Your system is configured with an old Cloudflare account that must not be used."
                : "Your Cloudflare account configuration doesn't match the required account for this environment."}
              <div style={S.details}>
                {accountError?.error}
                {diagnosis.errors.length > 1 && ` (+${diagnosis.errors.length - 1} more issue${diagnosis.errors.length > 2 ? 's' : ''})`}
              </div>
            </div>
          </div>
        </div>

        <div style={S.actions}>
          {fixResult ? (
            fixResult.success ? (
              <span style={{ fontSize: "13px", fontWeight: 600 }}>
                ✓ Fixed. Reloading...
              </span>
            ) : (
              <span style={{ fontSize: "13px", color: "#FECACA" }}>
                ✗ Fix failed: {fixResult.error}
              </span>
            )
          ) : (
            <>
              <button
                style={{ ...S.button, ...S.buttonPrimary }}
                onClick={handleFix}
                disabled={fixing}
              >
                {fixing ? "Fixing..." : "Auto-Fix Now"}
              </button>
              <button
                style={{ ...S.button, ...S.buttonSecondary }}
                onClick={() => onSettingsFixed?.()}
              >
                Open Settings
              </button>
            </>
          )}

          <button
            style={S.closeButton}
            onClick={handleDismiss}
            title="Dismiss (not recommended)"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}