/**
 * Cloudflare Account Lock & Verification Service
 *
 * CRITICAL: Prevents configuration drift and cross-account deployments
 * enforces strict account ID validation at runtime
 */

// The ONE TRUE source of truth for Cloudflare account
export const LOCKED_CF_ACCOUNT_ID = 'ef771cfd6197dedb36bb3cea22ecf4fc';
export const LOCKED_CF_API_TOKEN = '8dTwYeTJF93WbhAyi2FzhUe8PV3rIEta5b8Pq5MQ';

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
 * Sanitize settings by forcing locked account values
 * @param {object} settings - Settings object to sanitize
 * @returns {object} Sanitized settings with locked account enforced
 */
export function sanitizeSettings(settings) {
  const sanitized = { ...settings };

  // ALWAYS enforce the locked account ID
  sanitized.cfAccountId = LOCKED_CF_ACCOUNT_ID;

  // ALWAYS enforce the locked API token
  sanitized.cfApiToken = LOCKED_CF_API_TOKEN;

  // Remove any legacy account references
  if (sanitized.d1AccountId === LEGACY_CF_ACCOUNT_ID) {
    delete sanitized.d1AccountId;
  }

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
