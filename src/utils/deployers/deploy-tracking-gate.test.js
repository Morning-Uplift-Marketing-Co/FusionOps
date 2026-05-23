import { describe, it, expect } from "vitest";
import {
  DEFAULT_PIXEL_WORKER_SCRIPT,
  resolvePixelScriptName,
  evaluateDeployTrackingGate,
  pixelHealthFromVerification,
} from "./deploy-tracking-gate.js";

describe("deploy-tracking-gate", () => {
  it("defaults pixel script to lp-factory-api", () => {
    expect(resolvePixelScriptName({})).toBe(DEFAULT_PIXEL_WORKER_SCRIPT);
    expect(DEFAULT_PIXEL_WORKER_SCRIPT).toBe("lp-factory-api");
  });

  it("respects settings override for pixel script name", () => {
    expect(resolvePixelScriptName({ pixelWorkerScriptName: "custom-worker" })).toBe("custom-worker");
  });

  it("skips gate when site has no custom domain", () => {
    const gate = evaluateDeployTrackingGate({ domain: "" });
    expect(gate.success).toBe(true);
    expect(gate.skipped).toBe(true);
  });

  it("fails when domain is set but route was not created", () => {
    const gate = evaluateDeployTrackingGate({
      domain: "bearlendlng.com",
      routeCreated: false,
      routeError: "Zone not found",
      trackingVerification: { success: true, checks: {} },
    });
    expect(gate.success).toBe(false);
    expect(gate.error).toMatch(/tracking not ready/i);
    expect(gate.error).toMatch(/Zone not found/);
  });

  it("fails when route ok but API verify reports pixel failure", () => {
    const gate = evaluateDeployTrackingGate({
      domain: "bearlendlng.com",
      routeCreated: true,
      trackingVerification: {
        success: false,
        checks: { pixelEndpoint: { ok: false, status: 404 } },
      },
    });
    expect(gate.success).toBe(false);
    expect(gate.pixelHealthError).toMatch(/404/);
  });

  it("passes when route and verify both succeed", () => {
    const gate = evaluateDeployTrackingGate({
      domain: "bearlendlng.com",
      routeCreated: true,
      trackingVerification: {
        success: true,
        checks: {
          workerHealth: { ok: true, status: 200 },
          pixelEndpoint: { ok: true, status: 200 },
        },
      },
    });
    expect(gate.success).toBe(true);
    expect(gate.pixelHealthOk).toBe(true);
  });

  it("passes cf-pages style provision + client health check", () => {
    const gate = evaluateDeployTrackingGate({
      domain: "bearlendlng.com",
      pixelProvisioned: true,
      pixelHealthOk: true,
    });
    expect(gate.success).toBe(true);
  });

  it("passes when pixel health ok even if CF provision failed (existing wrangler route)", () => {
    const gate = evaluateDeployTrackingGate({
      domain: "gotogetherloans.com",
      pixelProvisioned: false,
      pixelError: "Zone not found for gotogetherloans.com",
      pixelHealthOk: true,
    });
    expect(gate.success).toBe(true);
  });

  it("resolves CF credentials from site cfProfileId", async () => {
    const { resolveCfCredentials } = await import("./deploy-tracking-gate.js");
    const creds = resolveCfCredentials(
      { cfProfileId: "profile-1" },
      {
        cfProfiles: [{ id: "profile-1", accountId: "ef771cfd6197dedb36bb3cea22ecf4fc", apiToken: "cf-token" }],
      },
    );
    expect(creds.cfAccountId).toBe("ef771cfd6197dedb36bb3cea22ecf4fc");
    expect(creds.cfApiToken).toBe("cf-token");
  });

  it("maps verify response to pixelHealth fields", () => {
    const ok = pixelHealthFromVerification({ success: true, checks: { pixelEndpoint: { ok: true } } });
    expect(ok.pixelHealthOk).toBe(true);

    const bad = pixelHealthFromVerification({
      success: false,
      checks: { pixelEndpoint: { ok: false, status: 502 } },
    });
    expect(bad.pixelHealthOk).toBe(false);
    expect(bad.pixelHealthError).toMatch(/502/);
  });
});
