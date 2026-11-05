import { buildProject } from "@blend65/compiler";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "../rd05/profile-fixture.js";
import { withLibraryVice } from "../rd05/source-library-fixture.js";

describe("stack-pressure constructor return visibility", () => {
  it.each([
    { pushes: 187, nops: 38_440, succeeds: true },
    { pushes: 236, nops: 38_350, succeeds: false },
  ])(
    "should preserve visibility for $pushes pushes and $nops NOPs",
    async ({ pushes, nops, succeeds }) => {
      const source = [
        "module Game; function main(): void { asm_sei();",
        "asm_php();".repeat(pushes),
        "asm_plp();".repeat(pushes),
        "asm_nop();".repeat(nops),
        "}",
      ].join("\n");
      await withProfileProject(source, "c64-pal-prg-kernal-6581", async (project, root) => {
        const built = await buildProject({ project, optimization: "none" });
        if (!succeeds) {
          expect(built.kind).toBe("failure");
          expect(built.diagnostics).toContainEqual(
            expect.objectContaining({ code: "COMPILER_LAYOUT", severity: "error" }),
          );
          expect(built).not.toHaveProperty("generation");
          await expect(readdir(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
          return;
        }
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error("Expected the visible compact fallback");
        const artifacts = await readProfileArtifacts(built);
        const state = profileRecords(artifacts.memory.intervals).filter(
          ({ id }) => id === "platform.startup-state",
        );
        expect(state).toHaveLength(1);
        expect(state[0]).toMatchObject({ size: 3 });
        const domains = profileRecords(artifacts.memory.stackDomains).filter(
          ({ id }) => id === "bounded-component-capacity",
        );
        expect(domains).toHaveLength(1);
        expect(domains[0]).toMatchObject({ peakBytes: 188 });
      });
    },
    300_000,
  );

  it("should reject a replacement hidden by BASIC banking and retain a safe return", async () => {
    // The larger display constructor crosses the BASIC window for this source.
    // Resource capacity alone cannot establish that its return path is executable.
    const source = [
      "module Game; function main(): void { asm_sei();",
      "asm_php();".repeat(187),
      "asm_plp();".repeat(187),
      "asm_nop();".repeat(38_000),
      "}",
    ].join("\n");
    const profile = "c64-pal-prg-kernal-6581";
    await withProfileProject(source, profile, async (project) => {
      const built = await buildProject({ project, optimization: "none" });
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (built.kind !== "success") throw new Error("Expected a visible returning construction");
      const artifacts = await readProfileArtifacts(built);
      const state = profileRecords(artifacts.memory.intervals).filter(
        ({ id }) => id === "platform.startup-state",
      );
      expect(state).toHaveLength(1);
      const start = state[0]?.start;
      const end = state[0]?.end;
      if (typeof start !== "number" || typeof end !== "number")
        throw new TypeError("Expected actual saved-state endpoints");
      expect(end <= 0xa000 || start >= 0xc000).toBe(true);
      const domains = profileRecords(artifacts.memory.stackDomains).filter(
        ({ id }) => id === "bounded-component-capacity",
      );
      expect(domains).toHaveLength(1);
      const peak = domains[0]?.peakBytes;
      if (typeof peak !== "number") throw new TypeError("Expected actual bounded stack use");
      expect(peak).toBeLessThanOrEqual(188);
      await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
        const entry = await monitor.readCpuRegisters();
        // Observe the pinned SYS continuation before BASIC changes P or pushes.
        await stopAt(0xe147);
        const returned = await monitor.readCpuRegisters();
        expect(returned.sp).toBe((entry.sp + 2) & 0xff);
        expect(returned.p & 0xcf).toBe(entry.p & 0xcf);
      });
    });
  }, 300_000);
});
