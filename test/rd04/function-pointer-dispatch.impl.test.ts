import { buildProject } from "@blend65/compiler";
import type { OptimizationGoal } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { readProfileArtifacts, withProfileProject } from "../rd05/profile-fixture.js";

const target = "c64-pal-prg-kernal-6581";

/** Optional optimization must not change which dispatch shape a program receives. */
const modes: readonly OptimizationGoal[] = ["none", "balanced", "speed", "size"];

/**
 * A pointer call with two candidates followed by arithmetic. Holding the pointer in a frame slot
 * with no arguments and a scalar result is the shape that earns the cheap dispatch, and the
 * arithmetic afterwards is what consumes processor state the call must leave intact.
 */
const source = `module Game;
function chosen(): byte { return 37; }
function other(): byte { return 11; }
function main(): void {
  let hook: fn(): byte = &chosen;
  if (peek($C000) == 1) { hook = &other; }
  let i: byte = 0;
  poke($C100, hook());
  i = i + 1;
  poke($C101, i);
}
`;

/** A dispatch block, found by the indirect transfer that forms its whole body. */
const indirectTransfer = /^\s*jmp\s+\(\$[0-9a-f]{4}\)\s*$/imu;

/** Comparing the pointer against a candidate address is the alternative, costlier dispatch. */
const candidateComparison = /^\s*cmp\s+#[<>]\(/gimu;

describe.each(modes)("pointer dispatch for a call followed by arithmetic in mode %s", (mode) => {
  /**
   * Acceptance of this program depends on facts recorded on the dispatch block, and the layout
   * is validated again after binding, after cost selection, after address resolution, after
   * compaction and before assembly. A stage that dropped those facts would reject the program
   * there, so a published artifact is evidence they survive the whole pipeline.
   *
   * The assertions about the emitted dispatch are the separate half: the program must not be
   * made acceptable by replacing the pointer jump with a chain of address comparisons, which
   * costs two compares and two branches per candidate and grows with the candidate count.
   */
  it("should publish, keep the indirect transfer, and keep the arithmetic", async () => {
    await withProfileProject(source, target, async (project) => {
      const built = await buildProject({ project, optimization: mode });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("The dispatch program reached no publication");
      const { assembly } = await readProfileArtifacts(built);

      expect(assembly, "the cheap pointer dispatch must survive the repair").toMatch(
        indirectTransfer,
      );
      expect(
        [...assembly.matchAll(candidateComparison)],
        "a published program must not fall back to comparing candidate addresses",
      ).toHaveLength(0);
      expect(assembly, "the arithmetic after the call must still be emitted").toMatch(
        /^\s*adc\s+#\$01\s*$/imu,
      );
    });
  }, 60_000);
});
