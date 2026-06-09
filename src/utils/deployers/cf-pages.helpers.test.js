import { describe, expect, it } from "vitest";
import { normalizePagesFileEntries, resolvePagesProjectName } from "./cf-pages.js";

describe("resolvePagesProjectName", () => {
  it("uses site.cfPagesProject when set", () => {
    expect(
      resolvePagesProjectName({ domain: "scratchcareday.com", cfPagesProject: "lp-scratchcareday-com" })
    ).toBe("lp-scratchcareday-com");
  });

  it("derives lp-{slug} from domain without site id suffix", () => {
    expect(resolvePagesProjectName({ domain: "scratchcareday.com", id: "abc123" })).toBe(
      "lp-scratchcareday-com"
    );
  });
});

describe("normalizePagesFileEntries", () => {
  it("drops bare / when /index.html exists", () => {
    const normalized = normalizePagesFileEntries({
      "/": "<html>home</html>",
      "/index.html": "<html>home</html>",
      "/apply.html": "<html>apply</html>",
      "/apply": "<html>apply</html>",
    });
    expect(Object.keys(normalized).sort()).toEqual(["/apply.html", "/index.html"]);
  });
});
