import { describe, it, expect } from "vitest";
import { getProviderFallbackOrder, getProxyConfig } from "../proxy-providers.js";

describe("getProviderFallbackOrder", () => {
  it("puts proxyPrimaryProvider first", () => {
    const order = getProviderFallbackOrder({ proxyPrimaryProvider: "soax" });
    expect(order[0]).toBe("soax");
    expect(order).toHaveLength(4);
    expect(new Set(order).size).toBe(4);
  });

  it("defaults to nodemaven when primary invalid", () => {
    const order = getProviderFallbackOrder({ proxyPrimaryProvider: "unknown" });
    expect(order[0]).toBe("nodemaven");
  });

  it("uses proxyFallbackOrder JSON when valid", () => {
    const order = getProviderFallbackOrder({
      proxyFallbackOrder: JSON.stringify(["brightdata", "nodemaven"]),
    });
    expect(order).toEqual(["brightdata", "nodemaven"]);
  });

  it("filters unknown ids from proxyFallbackOrder", () => {
    const order = getProviderFallbackOrder({
      proxyFallbackOrder: JSON.stringify(["soax", "not-a-provider", "smartproxy"]),
    });
    expect(order).toEqual(["soax", "smartproxy"]);
  });
});

describe("getProxyConfig smartproxy", () => {
  it("prefixes user- for Smartproxy/Decodo and formats US state as state-us_*", () => {
    const cfg = getProxyConfig(
      "smartproxy",
      {
        profileId: "prof1",
        geo: { country: "US", state: "California", city: "Los Angeles" },
        protocol: "http",
        sessionId: "sessabc",
      },
      { spProxyUser: "mysubaccount", spProxyPassword: "secret" }
    );
    expect(cfg.error).toBeUndefined();
    expect(cfg.username).toMatch(/^user-mysubaccount/);
    expect(cfg.username).toContain("country-us");
    expect(cfg.username).toContain("state-us_california");
    expect(cfg.username).toContain("city-los_angeles");
    expect(cfg.username).toContain("session-sessabc");
  });

  it("does not double user- if already present", () => {
    const cfg = getProxyConfig(
      "smartproxy",
      { profileId: "p1", geo: { country: "th" }, sessionId: "s1" },
      { spProxyUser: "user-already", spProxyPassword: "x" }
    );
    expect(cfg.error).toBeUndefined();
    expect(cfg.username).toMatch(/^user-already-country-th/);
  });

  it("defaults Smartproxy host to gate.decodo.com:7000", () => {
    const cfg = getProxyConfig(
      "smartproxy",
      { profileId: "p1", geo: { country: "us" }, sessionId: "s1" },
      { spProxyUser: "sub", spProxyPassword: "pw" }
    );
    expect(cfg.error).toBeUndefined();
    expect(cfg.host).toBe("gate.decodo.com");
    expect(cfg.port).toBe(7000);
  });

  it("respects spProxyHost and spProxyHttpPort overrides", () => {
    const cfg = getProxyConfig(
      "smartproxy",
      { profileId: "p1", geo: { country: "us" }, sessionId: "s1" },
      { spProxyUser: "sub", spProxyPassword: "pw", spProxyHost: "gate.smartproxy.com", spProxyHttpPort: 10001 }
    );
    expect(cfg.host).toBe("gate.smartproxy.com");
    expect(cfg.port).toBe(10001);
  });

  it("does not duplicate geo when Settings username is already a composed dashboard string", () => {
    const cfg = getProxyConfig(
      "smartproxy",
      { profileId: "p1", geo: { country: "th", city: "bangkok" }, sessionId: "sticky1" },
      { spProxyUser: "user-myacc-country-us", spProxyPassword: "x" }
    );
    expect(cfg.error).toBeUndefined();
    expect(cfg.username).toBe("user-myacc-country-us-session-sticky1");
    expect(cfg.username).not.toContain("country-th");
  });

  it("keeps regional _area-XX dashboard username verbatim (no user- prefix, no profile country)", () => {
    const fullUser = "smart-fusionops_area-TH_state-BANGKOK_life-120_session-1zHhaXnkXC";
    const cfg = getProxyConfig(
      "smartproxy",
      { profileId: "p1", geo: { country: "us", state: "CA" }, sessionId: "appsticky" },
      { spProxyUser: fullUser, spProxyPassword: "x", spProxyHost: "as.smartproxy.net", spProxyHttpPort: 3120 }
    );
    expect(cfg.error).toBeUndefined();
    expect(cfg.username).toBe(fullUser);
    expect(cfg.username).not.toMatch(/^user-/);
    expect(cfg.username).not.toContain("country-us");
    expect(cfg.host).toBe("as.smartproxy.net");
    expect(cfg.port).toBe(3120);
  });

  it("appends session to regional username only when no session segment exists", () => {
    const base = "sub_area-TH_state-BANGKOK_life-120";
    const cfg = getProxyConfig(
      "smartproxy",
      { profileId: "p1", geo: { country: "th" }, sessionId: "sid9" },
      { spProxyUser: base, spProxyPassword: "x" }
    );
    expect(cfg.error).toBeUndefined();
    expect(cfg.username).toBe(`${base}-session-sid9`);
  });
});
