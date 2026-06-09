import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./deploy-tracking-gate.js", () => ({
  resolvePixelScriptName: () => "pixel-worker",
  evaluateDeployTrackingGate: () => ({ success: true }),
  trackingRequiredForDomain: () => false,
  resolveCfCredentials: () => ({ cfAccountId: "", cfApiToken: "" }),
  checkPixelEndpointHealth: () => ({ ok: true }),
}));

vi.mock("../../services/cloudflare-dns.js", () => ({
  ensurePixelSubdomain: vi.fn(),
}));

import { deploy } from "./github-actions.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function makeResponse({ ok, status, json, text }) {
  return {
    ok,
    status,
    json: async () => (typeof json === "function" ? json() : json),
    text: async () => (typeof text === "function" ? text() : text || ""),
  };
}

describe("github-actions deployer", () => {
  it("pushes the deploy config and dispatches the deploy workflow", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeResponse({ ok: false, status: 404 }))
      .mockResolvedValueOnce(makeResponse({ ok: false, status: 404 }))
      .mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          json: { commit: { sha: "commit-sha", html_url: "https://github.com/acme/repo/commit/commit-sha" } },
        })
      )
      .mockResolvedValueOnce(makeResponse({ ok: true, status: 204 }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await deploy(
      {},
      { domain: "example.com", templateId: "installment-bear", brand: "Example Brand" },
      {
        githubToken: "token123",
        githubRepoOwner: "acme",
        githubRepoName: "repo",
      }
    );

    expect(result.success).toBe(true);
    expect(result.workflowDispatched).toBe(true);
    expect(result.workflowDispatchError).toBeNull();
    expect(result.actionsUrl).toBe("https://github.com/acme/repo/actions/workflows/deploy-lp.yml");
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const dispatchCall = fetchMock.mock.calls[3];
    expect(dispatchCall[0]).toBe(
      "https://api.github.com/repos/acme/repo/actions/workflows/deploy-lp.yml/dispatches"
    );
    expect(dispatchCall[1]?.method).toBe("POST");
    expect(JSON.parse(dispatchCall[1]?.body)).toEqual({
      ref: "main",
      inputs: { config_file: "deploy-configs/example.com.json" },
    });
  });

  it("returns success and a fallback hint when workflow dispatch fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeResponse({ ok: false, status: 404 }))
      .mockResolvedValueOnce(makeResponse({ ok: false, status: 404 }))
      .mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          json: { commit: { sha: "commit-sha", html_url: "https://github.com/acme/repo/commit/commit-sha" } },
        })
      )
      .mockResolvedValueOnce(makeResponse({ ok: false, status: 403, text: "forbidden" }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await deploy(
      {},
      { domain: "example.com", templateId: "installment-bear" },
      {
        githubToken: "token123",
        githubRepoOwner: "acme",
        githubRepoName: "repo",
      }
    );

    expect(result.success).toBe(true);
    expect(result.workflowDispatched).toBe(false);
    expect(result.workflowDispatchError).toContain("Workflow dispatch failed (403)");
    expect(result.message).toContain('Run "Deploy Landing Page" manually in GitHub Actions');
  });
});
