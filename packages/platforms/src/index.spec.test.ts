import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLATFORM,
  PLATFORM_REGISTRY,
  loadPlatform,
  c64Plugin,
} from "./index.js";

describe("@blend65/platforms public surface", () => {
  it("exposes the registry, loader, and default platform", () => {
    expect(typeof loadPlatform).toBe("function");
    expect(DEFAULT_PLATFORM).toBe("c64");
    expect(PLATFORM_REGISTRY.get("c64")).toBe(c64Plugin);
  });
});
