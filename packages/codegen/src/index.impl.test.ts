/** Implementation coverage for the package-root public type barrel. */

import { describe, expect, it } from "vitest";

import type { PrintILOptions } from "./index.js";

describe("@blend65/codegen implementation surface", () => {
  it("should export the additive IL printer options type from the package root", () => {
    const options: PrintILOptions = { exposeEffects: true };

    expect(options).toEqual({ exposeEffects: true });
  });
});
