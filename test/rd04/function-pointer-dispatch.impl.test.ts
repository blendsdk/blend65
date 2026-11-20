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

/** Build one program and return its published assembly, failing with the refusal if any. */
async function assemble(text: string, optimization: OptimizationGoal = "none"): Promise<string> {
  return withProfileProject(text, target, async (project) => {
    const built = await buildProject({ project, optimization });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") throw new Error("The program reached no publication");
    return (await readProfileArtifacts(built)).assembly;
  });
}

/**
 * A signed result must be compared as signed however the call was dispatched. The biasing
 * exclusive-or is how an ordering comparison on a signed byte is lowered; an unsigned comparison
 * omits it and treats a negative value as a large positive one, choosing the wrong branch.
 */
describe("a signed result returned through a function variable", () => {
  const body = (parameters: string, argument: string) => `module Game;
function down(${parameters}): sbyte { return -5; }
function up(${parameters}): sbyte { return 7; }
function main(): void {
  let pick: fn(${parameters === "" ? "" : "byte"}): sbyte = &down;
  if (peek($C000) == 1) { pick = &up; }
  if (pick(${argument}) < 0) { poke($C100, 1); } else { poke($C100, 2); }
}
`;

  it("should compare as signed whether the call is dispatched or selected by comparison", async () => {
    const dispatched = await assemble(body("", ""));
    const selected = await assemble(body("k: byte", "3"));

    expect(dispatched, "the dispatched call must take the indirect transfer").toMatch(
      indirectTransfer,
    );
    expect(
      [...selected.matchAll(candidateComparison)].length,
      "the parameterised call must take the comparison route, so the two routes are contrasted",
    ).toBeGreaterThan(0);

    const signedBias = /^\s*eor\s+#\$80\s*$/imu;
    expect(selected, "the comparison route establishes the expected signed form").toMatch(
      signedBias,
    );
    expect(dispatched, "the dispatched route must agree with it").toMatch(signedBias);
  }, 60_000);
});

/**
 * Shapes neighbouring the repaired case that reach the dispatch and were previously unpinned.
 * Each is legal, so each must publish; the point is that the dispatch summary is exercised
 * through a loop back edge, through more than two candidates, through a candidate that itself
 * dispatches, through two calls on one variable, and past a candidate that never returns.
 */
describe("neighbouring dispatch shapes", () => {
  it.each([
    [
      "a candidate that never returns",
      `module Game;
function tick(): void { poke($C100, 1); }
function spin(): void { while (true) { } }
function main(): void {
  let hook: fn(): void = &tick;
  if (peek($C000) == 1) { hook = &spin; }
  hook();
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, i);
}
`,
    ],
    [
      "three candidates",
      `module Game;
function one(): byte { return 1; }
function two(): byte { return 2; }
function three(): byte { return 3; }
function main(): void {
  let hook: fn(): byte = &one;
  if (peek($C000) == 1) { hook = &two; }
  if (peek($C001) == 1) { hook = &three; }
  poke($C100, hook());
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, i);
}
`,
    ],
    [
      "the call inside a loop, with arithmetic on a local declared outside it",
      `module Game;
function one(): byte { return 1; }
function two(): byte { return 2; }
function main(): void {
  let hook: fn(): byte = &one;
  if (peek($C000) == 1) { hook = &two; }
  let i: byte = peek($C002);
  while (i < 4) { poke($C100, hook()); i = i + peek($C003); }
  poke($C101, i);
}
`,
    ],
    [
      "a candidate that itself calls through a function variable",
      `module Game;
function leaf(): byte { return 1; }
function other(): byte { return 2; }
function nested(): byte {
  let inner: fn(): byte = &leaf;
  if (peek($C004) == 1) { inner = &other; }
  return inner();
}
function plain(): byte { return 3; }
function main(): void {
  let hook: fn(): byte = &nested;
  if (peek($C000) == 1) { hook = &plain; }
  poke($C100, hook());
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, i);
}
`,
    ],
    [
      "two calls through one variable in one body",
      `module Game;
function one(): byte { return 1; }
function two(): byte { return 2; }
function main(): void {
  let hook: fn(): byte = &one;
  if (peek($C000) == 1) { hook = &two; }
  poke($C100, hook());
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, hook());
  poke($C102, i);
}
`,
    ],
  ])(
    "should publish with %s",
    async (_name, text) => {
      await assemble(text);
    },
    60_000,
  );
});
