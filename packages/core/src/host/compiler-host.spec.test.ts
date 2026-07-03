/**
 * Specification test for the RD-15 `CompilerHost` interface shape — ST-1.
 *
 * Derived EXCLUSIVELY from RD-15 R14/§4.2 and the plan (03-01-compiler-host.md,
 * AR-V9). Immutable oracle: the interface has exactly three members —
 * `listSourceFiles(): string[]`, `readFile(path): string | undefined`,
 * `resolvePath(path): string` — re-exported from the `@blend65/core` root barrel.
 */

import { describe, expect, it } from "vitest";
import type { CompilerHost } from "@blend65/core";

describe("Specification: CompilerHost interface shape (ST-1)", () => {
  it("type-checks a minimal in-memory implementation with exactly the three members (ST-1)", () => {
    const files: Record<string, string> = { "/proj/main.blend": "module Main;" };

    const host: CompilerHost = {
      listSourceFiles(): string[] {
        return Object.keys(files).sort();
      },
      readFile(path: string): string | undefined {
        return files[path];
      },
      resolvePath(path: string): string {
        return path;
      },
    };

    expect(host.listSourceFiles()).toEqual(["/proj/main.blend"]);
    expect(host.readFile("/proj/main.blend")).toBe("module Main;");
    expect(host.readFile("/proj/missing.blend")).toBeUndefined();
    expect(host.resolvePath("/proj/main.blend")).toBe("/proj/main.blend");
  });
});
