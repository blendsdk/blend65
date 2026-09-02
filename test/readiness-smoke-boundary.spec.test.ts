import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const SMOKE_CONFIG = "packages/readiness-execution/vitest.smoke.config.ts";

describe("readiness smoke boundary", () => {
  it("keeps real VICE launch suites in the explicit full readiness tier", () => {
    const config = readFileSync(SMOKE_CONFIG, "utf8");

    expect(config).not.toContain("execution-vice-production.impl.test.ts");
    expect(config).not.toContain("execution-vice-local.impl.test.ts");
  });
});
