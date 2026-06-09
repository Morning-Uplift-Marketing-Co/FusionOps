import { describe, expect, it } from 'vitest';
import {
  LEGACY_D1_MAIN_DATABASE_IDS,
  PRODUCTION_D1_MAIN_DATABASE_ID,
  healD1SettingsInPlace,
  resolveD1DatabaseIds,
} from '../../apps/api-worker/src/lib/d1-settings-heal.js';

describe('worker d1-settings-heal', () => {
  it('migrates legacy cfD1DatabaseId', () => {
    const settings = { cfD1DatabaseId: LEGACY_D1_MAIN_DATABASE_IDS[0] };
    expect(healD1SettingsInPlace(settings)).toBe(true);
    expect(settings.d1DatabaseId).toBe(PRODUCTION_D1_MAIN_DATABASE_ID);
    expect(settings.cfD1DatabaseId).toBe(PRODUCTION_D1_MAIN_DATABASE_ID);
  });

  it('prefers non-legacy d1DatabaseId over stale cf*', () => {
    const resolved = resolveD1DatabaseIds({
      d1DatabaseId: PRODUCTION_D1_MAIN_DATABASE_ID,
      cfD1DatabaseId: LEGACY_D1_MAIN_DATABASE_IDS[0],
    });
    expect(resolved.d1DatabaseId).toBe(PRODUCTION_D1_MAIN_DATABASE_ID);
    expect(resolved.cfD1DatabaseId).toBe(PRODUCTION_D1_MAIN_DATABASE_ID);
  });
});
