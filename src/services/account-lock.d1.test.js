import { describe, expect, it } from "vitest";
import {
  LEGACY_CF_ACCOUNT_ID,
  LEGACY_D1_MAIN_DATABASE_IDS,
  PRODUCTION_D1_MAIN_DATABASE_ID,
  PRODUCTION_CF_ACCOUNT_ID,
  getLockedCfAccountId,
  resolveD1DatabaseIds,
  sanitizeCfProfiles,
  sanitizeSettings,
} from "./account-lock.js";

describe("resolveD1DatabaseIds", () => {
  it("migrates legacy main DB UUID to production id", () => {
    const legacyId = LEGACY_D1_MAIN_DATABASE_IDS[0];
    expect(resolveD1DatabaseIds({ cfD1DatabaseId: legacyId })).toEqual({
      d1DatabaseId: PRODUCTION_D1_MAIN_DATABASE_ID,
      cfD1DatabaseId: PRODUCTION_D1_MAIN_DATABASE_ID,
    });
  });

  it("prefers d1DatabaseId when cfD1DatabaseId is stale", () => {
    expect(
      resolveD1DatabaseIds({
        d1DatabaseId: PRODUCTION_D1_MAIN_DATABASE_ID,
        cfD1DatabaseId: LEGACY_D1_MAIN_DATABASE_IDS[0],
      })
    ).toEqual({
      d1DatabaseId: PRODUCTION_D1_MAIN_DATABASE_ID,
      cfD1DatabaseId: PRODUCTION_D1_MAIN_DATABASE_ID,
    });
  });

  it("copies cfD1DatabaseId to d1DatabaseId when only cf is set", () => {
    expect(
      resolveD1DatabaseIds({ cfD1DatabaseId: PRODUCTION_D1_MAIN_DATABASE_ID })
    ).toEqual({
      d1DatabaseId: PRODUCTION_D1_MAIN_DATABASE_ID,
      cfD1DatabaseId: PRODUCTION_D1_MAIN_DATABASE_ID,
    });
  });

  it("forces locked main DB UUID when D1_MAIN_DATABASE_ID_LOCKED", () => {
    const arbitraryId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(resolveD1DatabaseIds({ d1DatabaseId: arbitraryId })).toEqual({
      d1DatabaseId: PRODUCTION_D1_MAIN_DATABASE_ID,
      cfD1DatabaseId: PRODUCTION_D1_MAIN_DATABASE_ID,
    });
  });
});

describe("sanitizeSettings D1 merge", () => {
  it("auto-heals legacy cfD1DatabaseId on sanitize", () => {
    const sanitized = sanitizeSettings({
      cfD1DatabaseId: LEGACY_D1_MAIN_DATABASE_IDS[0],
    });
    expect(sanitized.d1DatabaseId).toBe(PRODUCTION_D1_MAIN_DATABASE_ID);
    expect(sanitized.cfD1DatabaseId).toBe(PRODUCTION_D1_MAIN_DATABASE_ID);
  });
});

describe("sanitizeCfProfiles", () => {
  it("forces locked account id on all profiles", () => {
    const healed = sanitizeCfProfiles([
      { id: "legacy", name: "Default", accountId: LEGACY_CF_ACCOUNT_ID, apiToken: "tok" },
    ]);
    expect(healed[0].accountId).toBe(getLockedCfAccountId());
    expect(healed[0].accountId).toBe(PRODUCTION_CF_ACCOUNT_ID);
  });
});
