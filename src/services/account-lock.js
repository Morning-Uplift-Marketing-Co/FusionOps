/**
 * Cloudflare Account Lock & Verification Service
 *
 * CRITICAL: Prevents configuration drift and cross-account deployments
 * enforces strict account ID validation at runtime
 */

// The ONE TRUE source of truth for Cloudflare account — read from environment
export const LOCKED_CF_ACCOUNT_ID = import.meta.env.VITE_CF_ACCOUNT_ID || '';
export const LOCKED_CF_API_TOKEN = import.meta.env.VITE_CF_API_TOKEN || '';

// Old account that should NEVER be used
export const LEGACY_CF_ACCOUNT_ID = '9fa4d356e0c6fa0612b3da1e03c7e707';

/**
 * Validate that a given account ID matches the locked account
 * @param {string} accountId - Account ID to validate
 * @returns {object} Validation result
 */
export function validateAccountId(accountId) {
  const normalized = (accountId || '').trim().toLowerCase();

  if (!normalized) {
    return {
      valid: false,
      error: 'No account ID provided',
      locked: LOCKED_CF_ACCOUNT_ID
    };
  }

  if (normalized === LEGACY_CF_ACCOUNT_ID.toLowerCase()) {
    return {
      valid: false,
      error: 'LEGACY ACCOUNT DETECTED - This account must not be used',
      legacy: LEGACY_CF_ACCOUNT_ID,
      locked: LOCKED_CF_ACCOUNT_ID,
      critical: true
    };
  }

  if (normalized !== LOCKED_CF_ACCOUNT_ID.toLowerCase()) {
    return {
      valid: false,
      error: 'Account ID mismatch',
      provided: normalized,
      locked: LOCKED_CF_ACCOUNT_ID
    };
  }

  return {
    valid: true,
    accountId: normalized
  };
}

/**
 * Check if settings object contains the correct locked account
 * @param {object} settings - Settings object to validate
 * @returns {object} Validation result with details
 */
export function validateSettingsAccount(settings) {
  const result = {
    valid: true,
    warnings: [],
    errors: [],
    fields: {}
  };

  // Check cfAccountId
  if (settings.cfAccountId) {
    const cfValidation = validateAccountId(settings.cfAccountId);
    if (!cfValidation.valid) {
      result.valid = false;
      result.errors.push({
        field: 'cfAccountId',
        message: cfValidation.error,
        critical: cfValidation.critical || false
      });
      result.fields.cfAccountId = cfValidation;
    }
  }

  // Check if API token matches locked account
  if (settings.cfApiToken && settings.cfApiToken !== LOCKED_CF_API_TOKEN) {
    result.warnings.push({
      field: 'cfApiToken',
      message: 'API token does not match locked account token'
    });
  }

  return result;
}

/**
 * Sanitize settings by forcing locked critical values
 * This prevents configuration drift when Neon disconnects or localStorage gets corrupted
 * @param {object} settings - Settings object to sanitize
 * @returns {object} Sanitized settings with locked values enforced
 */
export function sanitizeSettings(settings) {
  const sanitized = { ...settings };

  // CRITICAL: ALWAYS enforce the locked Cloudflare account
  sanitized.cfAccountId = LOCKED_CF_ACCOUNT_ID;
  sanitized.cfApiToken = LOCKED_CF_API_TOKEN;

  // CRITICAL: ALWAYS enforce Neon URL (from environment)
  // This prevents losing Neon connection when dashboard disconnects
  const envNeonUrl = import.meta.env.VITE_NEON_URL;
  if (envNeonUrl && envNeonUrl.includes('@')) {
    sanitized.neonUrl = envNeonUrl;
  }

  // CRITICAL: ALWAYS enforce Voluum credentials (prevent losing tracking)
  if (import.meta.env.VITE_VOLUUM_ACCESS_KEY_ID) {
    sanitized.voluumKeyId = import.meta.env.VITE_VOLUUM_ACCESS_KEY_ID;
  }
  if (import.meta.env.VITE_VOLUUM_ACCESS_KEY) {
    sanitized.voluumKey = import.meta.env.VITE_VOLUUM_ACCESS_KEY;
  }

  // Remove any legacy account references
  if (sanitized.d1AccountId === LEGACY_CF_ACCOUNT_ID) {
    delete sanitized.d1AccountId;
  }

  console.log('[AccountLock] Settings sanitized - critical values locked');
  return sanitized;
}

/**
 * Verify account at runtime by making a test API call
 * @param {string} accountId - Account ID to verify
 * @param {string} apiToken - API token for verification
 * @returns {Promise<object>} Verification result
 */
export async function verifyAccountWithAPI(accountId, apiToken) {
  const validation = validateAccountId(accountId);
  if (!validation.valid) {
    return {
      success: false,
      ...validation
    };
  }

  try {
    // Make a lightweight API call to verify account access
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.ok) {
      const account = await response.json();
      return {
        success: true,
        accountId,
        account: {
          id: account.id,
          name: account.name
        },
        verified: true
      };
    } else {
      return {
        success: false,
        error: 'API verification failed',
        status: response.status
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      verified: false
    };
  }
}

/**
 * Check localStorage for stale account data
 * @returns {object} Analysis of localStorage state
 */
export function diagnoseLocalStorage() {
  try {
    const settingsStr = localStorage.getItem('settings');
    if (!settingsStr) {
      return {
        found: false,
        issues: []
      };
    }

    const settings = JSON.parse(settingsStr);
    const issues = [];

    // Check for legacy account
    if (settings.cfAccountId === LEGACY_CF_ACCOUNT_ID) {
      issues.push({
        severity: 'CRITICAL',
        field: 'cfAccountId',
        issue: 'Legacy account stored in localStorage',
        value: settings.cfAccountId,
        recommendation: 'Clear localStorage immediately'
      });
    }

    // Check for mismatched account
    if (settings.cfAccountId && settings.cfAccountId !== LOCKED_CF_ACCOUNT_ID) {
      issues.push({
        severity: 'HIGH',
        field: 'cfAccountId',
        issue: 'Account ID mismatch',
        stored: settings.cfAccountId,
        expected: LOCKED_CF_ACCOUNT_ID
      });
    }

    return {
      found: true,
      settings,
      issues
    };
  } catch (error) {
    return {
      found: false,
      error: error.message,
      issues: []
    };
  }
}

/**
 * Clear stale account data from localStorage
 * @returns {boolean} Success status
 */
export function clearStaleAccountData() {
  try {
    const settingsStr = localStorage.getItem('settings');
    if (!settingsStr) return true;

    const settings = JSON.parse(settingsStr);

    // Only clear if it contains bad data
    if (settings.cfAccountId === LEGACY_CF_ACCOUNT_ID ||
        (settings.cfAccountId && settings.cfAccountId !== LOCKED_CF_ACCOUNT_ID)) {
      // Clear the entire settings object
      localStorage.removeItem('settings');

      // Immediately save sanitized defaults
      const sanitized = sanitizeSettings({
        cfAccountId: LOCKED_CF_ACCOUNT_ID,
        cfApiToken: LOCKED_CF_API_TOKEN
      });
      localStorage.setItem('settings', JSON.stringify(sanitized));

      return true;
    }

    return false;
  } catch (error) {
    console.error('[AccountLock] Failed to clear stale data:', error);
    return false;
  }
}

/**
 * Auto-recover settings from Neon when connection is restored
 * This ensures that when Neon reconnects, ALL settings are pulled back
 * and any missing values from localStorage are restored
 *
 * @param {object} neonSettings - Settings from Neon database
 * @param {object} localStorageSettings - Current localStorage settings
 * @returns {object} Merged and sanitized settings
 */
export function autoRecoverSettings(neonSettings, localStorageSettings = {}) {
  if (!neonSettings || typeof neonSettings !== 'object') {
    console.warn('[AccountLock] No Neon settings to recover from');
    return sanitizeSettings(localStorageSettings);
  }

  console.log('[AccountLock] 🔧 Auto-recovering settings from Neon...');
  console.log('[AccountLock] Neon keys:', Object.keys(neonSettings));
  console.log('[AccountLock] LocalStorage keys:', Object.keys(localStorageSettings));

  // Priority: Neon > Environment > LocalStorage > Default
  // But ALWAYS enforce locked account values
  const recovered = {
    // Start with all Neon settings
    ...neonSettings,

    // Fill in missing values from localStorage
    ...Object.fromEntries(
      Object.entries(localStorageSettings).filter(([key]) => !(key in neonSettings))
    ),
  };

  // CRITICAL: Always enforce locked values
  const sanitized = sanitizeSettings(recovered);

  console.log('[AccountLock] ✅ Settings recovered and sanitized');
  console.log('[AccountLock] Final keys:', Object.keys(sanitized).filter(k =>
    k !== 'cfApiToken' // Don't log token
  ));

  return sanitized;
}

/**
 * Check if settings are incomplete (missing critical values)
 * This helps identify when a Neon disconnect caused data loss
 *
 * @param {object} settings - Settings to check
 * @returns {object} { isIncomplete, missingKeys, recommendations }
 */
export function detectIncompleteSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return {
      isIncomplete: true,
      missingKeys: ['all'],
      recommendations: ['Reconnect to Neon to restore settings']
    };
  }

  // Critical settings that should always be present
  const criticalKeys = [
    'cfAccountId',
    'cfApiToken',
    'neonUrl',
  ];

  // Important but optional settings
  const optionalKeys = [
    'voluumKeyId',
    'voluumKey',
    'vpsHost',
    'vpsPath',
    'vpsUser',
  ];

  const missingCritical = [];
  const missingOptional = [];

  criticalKeys.forEach(key => {
    if (!settings[key]) {
      missingCritical.push(key);
    }
  });

  optionalKeys.forEach(key => {
    // Only check if it was previously set (has localStorage record)
    const localValue = localStorage.getItem('settings');
    if (localValue) {
      try {
        const parsed = JSON.parse(localValue);
        if (parsed[key] && !settings[key]) {
          missingOptional.push(key);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  });

  const isIncomplete = missingCritical.length > 0;

  const recommendations = [];
  if (missingCritical.length > 0) {
    recommendations.push(`Critical settings missing: ${missingCritical.join(', ')}`);
    recommendations.push('Reconnect to Neon to restore settings');
  }
  if (missingOptional.length > 0) {
    recommendations.push(`Optional settings missing: ${missingOptional.join(', ')}`);
  }

  return {
    isIncomplete,
    missingCritical,
    missingOptional,
    recommendations,
  };
}
