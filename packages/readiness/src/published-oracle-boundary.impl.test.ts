import { describe, expect, it } from "vitest";

import type { PublishedOracleContext } from "./index.js";
import * as readinessRoot from "./index.js";
import * as publishedOracle from "./published-oracle.js";

describe("published oracle package boundary", () => {
  it("retains the root context type while keeping callable entrypoints on the subpath", () => {
    const rootContext: PublishedOracleContext | undefined = undefined;

    expect(rootContext).toBeUndefined();
    expect(readinessRoot).not.toHaveProperty("createPublishedOracleContext");
    expect(readinessRoot).not.toHaveProperty("createPublishedOracleRequest");
    expect(readinessRoot).not.toHaveProperty("evaluatePublishedOracle");
    expect(publishedOracle.createPublishedOracleContext).toBeTypeOf("function");
    expect(publishedOracle.createPublishedOracleRequest).toBeTypeOf("function");
    expect(publishedOracle.evaluatePublishedOracle).toBeTypeOf("function");
  });
});
