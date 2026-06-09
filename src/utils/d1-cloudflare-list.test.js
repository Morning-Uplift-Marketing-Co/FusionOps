import { describe, expect, it } from "vitest";
import { matchD1Database, normalizeUuid } from "./d1-cloudflare-list.js";

describe("matchD1Database", () => {
  const databases = [
    { uuid: "4eaee76d-10fb-42a7-bb9d-50737c3da785", name: "fusionops-main-new-v2" },
    { uuid: "99437cde-5e7c-4b58-97ad-69e43019c6ff", name: "fusionops-pixel-new-v2" },
  ];

  it("matches by uuid case-insensitively", () => {
    const hit = matchD1Database(databases, "4EAEE76D-10FB-42A7-BB9D-50737C3DA785");
    expect(hit?.name).toBe("fusionops-main-new-v2");
  });

  it("falls back to canonical main db name", () => {
    const hit = matchD1Database(databases, "7d31d941-f863-46f5-99c2-2179de821573");
    expect(normalizeUuid(hit?.uuid)).toBe("4eaee76d-10fb-42a7-bb9d-50737c3da785");
  });
});
