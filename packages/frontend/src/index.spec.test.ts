import { describe, expect, it } from "vitest";
import { VERSION } from "./index.js";

describe("@blend65/frontend smoke", () => {
  it("exposes VERSION 0.1.0", () => {
    expect(VERSION).toBe("0.1.0");
  });
});
