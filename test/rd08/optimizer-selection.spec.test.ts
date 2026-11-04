import { execFile } from "node:child_process";
import { access, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProject, parseManifest } from "@blend65/compiler";
import type { BuildResult, BuildSuccess } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  compareOptimizationCosts,
  selectOptimizationCandidate,
} from "../../packages/compiler/dist/machine/optimization-cost.js";
import type {
  OptimizationCandidate,
  OptimizationCostVector,
  OptimizationCycleMeasurement,
  OptimizationSelection,
} from "../../packages/compiler/dist/machine/optimization-cost.js";
import { parseArguments } from "../../packages/cli/dist/args.js";
import { renderUsage } from "../../packages/cli/dist/render.js";
import {
  profileRecord,
  readProfileArtifacts,
  withProfileProject,
} from "../rd05/profile-fixture.js";

const PROFILE = "c64-pal-prg-kernal-6581";
const MODES = ["none", "balanced", "speed", "size"] as const;
const COMPARISON_MODES = ["balanced", "speed", "size"] as const;
const RESOURCE_IDS = ["zeroPage", "residentRam", "hardwareStack", "scratch"] as const;
const BIN = fileURLToPath(new URL("../../packages/cli/dist/bin.js", import.meta.url));

// One tiny legal program is enough for the public mode-surface and evidence checks.
const SOURCE = `module Game;
function sample(): byte { return 7; }
function main(): void { poke($C100, sample()); }
`;

type ResourceId = (typeof RESOURCE_IDS)[number];

/** One exact semantic-path cycle count. */
function exact(value: number): OptimizationCycleMeasurement {
  return { kind: "exact", value };
}

/** A cycle term whose honest value is unavailable. */
function unavailable(): OptimizationCycleMeasurement {
  return { kind: "unknown" };
}

/** Build a complete B/R/T vector with the fixed resource comparison order. */
function cost(
  programBytes: number,
  pathCycles: Readonly<Record<string, OptimizationCycleMeasurement>>,
  resources: Readonly<Partial<Record<ResourceId, number>>> = {},
): OptimizationCostVector {
  return {
    programBytes,
    pathCycles: Object.entries(pathCycles).map(([pathId, cycles]) => ({ pathId, cycles })),
    resources: RESOURCE_IDS.map((id) => ({
      kind: "standard" as const,
      id,
      value: resources[id] ?? 0,
    })),
  };
}

/** One stable candidate identity and its complete cost. */
function candidate(id: string, vector: OptimizationCostVector): OptimizationCandidate {
  return { id, cost: vector };
}

/** Build a minimal valid manifest, optionally with a specific optimization value. */
function manifest(overrides: Readonly<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    name: "selection-spec",
    sourceRoot: "src",
    entry: "Game",
    target: PROFILE,
    outDir: "out",
    ...overrides,
  });
}

/** Narrow an untyped build result at the test boundary. */
function isBuildResult(value: unknown): value is BuildResult {
  if (value === null || typeof value !== "object") return false;
  const kind = Reflect.get(value, "kind");
  return kind === "success" || kind === "failure";
}

/** A successful build carries the complete generation needed by the evidence readers. */
function isBuildSuccess(value: unknown): value is BuildSuccess {
  return isBuildResult(value) && value.kind === "success";
}

/**
 * Call the public build service with a mode that the current static type still
 * omits. The runtime allowlist is the behavior under test.
 */
async function buildWithMode(project: string, mode: string): Promise<BuildResult> {
  const value: unknown = await Reflect.apply(buildProject, undefined, [
    { project, optimization: mode },
  ]);
  if (!isBuildResult(value)) throw new TypeError("Expected a complete build result");
  return value;
}

/** Require one complete published generation whose records agree on the requested mode. */
async function expectPublished(built: BuildSuccess, mode: string) {
  const artifacts = await readProfileArtifacts(built);
  const options = profileRecord(profileRecord(artifacts.build.semanticInputs).options);
  expect(options.optimization).toBe(mode);
  expect(artifacts.costs.mode).toBe(mode);
  expect(artifacts.debug.optimization).toBe(mode);
  expect(artifacts.memory).toMatchObject({ profileId: PROFILE, acmeReconciled: true });
  expect(artifacts.prg.readUInt16LE(0)).toBe(0x0801);
  expect(artifacts.prg.length).toBeGreaterThan(2);
  return artifacts;
}

/** Execute the built command directly so option values never pass through a shell. */
function invoke(argv: readonly string[], cwd: string) {
  return new Promise<{ status: number; stdout: string; stderr: string }>((resolve, reject) => {
    execFile(
      process.execPath,
      [BIN, ...argv],
      { cwd, encoding: "utf8" },
      (error, stdout, stderr) => {
        if (error && (typeof error.code !== "number" || error.signal)) {
          reject(error);
          return;
        }
        resolve({ status: error ? Number(error.code) : 0, stdout, stderr });
      },
    );
  });
}

/** An unknown candidate may not win and may not become a stable-id tie. */
function expectNoUnknownSelection(
  selection: OptimizationSelection,
  unknownIds: readonly string[],
): void {
  if (selection.kind === "selected") {
    expect(unknownIds).not.toContain(selection.candidateId);
    expect(selection.tieBreak).toBe("none");
  } else {
    expect(selection.incomparableComponents.length).toBeGreaterThan(0);
  }
}

/** A nonempty set of distinct component names describes a real tradeoff. */
function expectTradeoffComponents(components: readonly string[]): void {
  expect(components.length).toBeGreaterThanOrEqual(2);
  expect(new Set(components).size).toBe(components.length);
  for (const component of components) expect(component.length).toBeGreaterThan(0);
  const named = components.join(" ").toLowerCase();
  expect(named).toMatch(/byte|programbytes|\bb\b/u);
  expect(named).toMatch(/cycle|path|\bt\b/u);
}

describe("public optimization mode surface", () => {
  // The manifest accepts every exact mode and records the value without coercion.
  it.each(MODES)("accepts %s in the manifest", (mode) => {
    const result = parseManifest(manifest({ optimization: mode }));
    expect(result.kind).toBe("success");
    if (result.kind !== "success") throw new Error("Expected an accepted optimization mode");
    expect(result.manifest.optimization).toBe(mode);
  });

  it("defaults the manifest to balanced when no mode is written", () => {
    const result = parseManifest(manifest());
    expect(result.kind).toBe("success");
    if (result.kind !== "success") throw new Error("Expected an accepted default mode");
    expect(result.manifest.optimization).toBe("balanced");
  });

  // A spelling outside the four-value allowlist fails as a field error with the
  // accepted values named, before any project or compiler work can start.
  it.each(["fast", "Balanced", "SPEED", "balanced ", "size ", "", 0, true, null])(
    "rejects the unsupported manifest mode %j",
    (mode) => {
      const result = parseManifest(manifest({ optimization: mode }));
      expect(result.kind).toBe("failure");
      if (result.kind !== "failure") throw new Error("Expected a rejected optimization mode");
      const diagnostic = result.diagnostics.find((entry) => entry.pointer === "/optimization");
      expect(diagnostic).toBeDefined();
      if (diagnostic === undefined) throw new Error("Expected an optimization field diagnostic");
      expect(diagnostic.severity).toBe("error");
      for (const accepted of MODES) expect(diagnostic.message.toLowerCase()).toContain(accepted);
      expect(result).not.toHaveProperty("manifest");
    },
  );

  // The CLI parser is the pre-compilation allowlist for both build and run.
  it.each(MODES)("accepts %s as a build and run override", (mode) => {
    for (const command of ["build", "run"] as const) {
      expect(parseArguments([command, "--project", "game", "--optimization", mode])).toEqual({
        kind: command,
        options: { project: "game", optimization: mode },
      });
    }
  });

  it.each(["fast", "Balanced", "SPEED", "balanced ", "size=1", ""])(
    "rejects the unsupported CLI mode %j",
    (mode) => {
      expect(parseArguments(["build", "--project", "game", "--optimization", mode])).toBeNull();
    },
  );

  it("documents all four modes in the CLI usage text", () => {
    const usage = renderUsage();
    for (const mode of MODES) expect(usage).toContain(mode);
    expect(usage).toMatch(/--optimization\s+<none\|balanced\|speed\|size>/u);
  });

  // The public build service accepts every mode and records it in all three
  // published records that describe the selected optimization.
  it.each(MODES)(
    "accepts %s through the build service and records it in complete evidence",
    async (mode) => {
      await withProfileProject(SOURCE, PROFILE, async (project) => {
        const built = await buildWithMode(project, mode);
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (!isBuildSuccess(built)) throw new Error("Expected a complete build");
        const artifacts = await expectPublished(built, mode);
        if (mode === "none") {
          expect(artifacts.costs.decisions).toEqual([]);
          expect(artifacts.debug.optimizations).toEqual([]);
        }
      });
    },
    120_000,
  );

  // Production build and run default to balanced when no selection is written.
  it("leaves the run mode to the manifest default when no override is given", () => {
    expect(parseArguments(["run", "--project", "game"])).toEqual({
      kind: "run",
      options: { project: "game" },
    });
  });

  it("records balanced when neither the manifest nor the caller selects a mode", async () => {
    await withProfileProject(SOURCE, PROFILE, async (project) => {
      await writeFile(project, manifest());
      const built = await buildProject({ project });
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (!isBuildSuccess(built)) throw new Error("Expected a complete default build");
      await expectPublished(built, "balanced");
    });
  }, 120_000);

  // An invalid service override is rejected before any output can be published.
  it.each(["fast", "Balanced", "balanced ", "size=1"])(
    "rejects the unsupported service mode %j before compilation",
    async (mode) => {
      await withProfileProject(SOURCE, PROFILE, async (project, root) => {
        const built = await buildWithMode(project, mode);
        expect(built.kind).toBe("failure");
        expect(built.diagnostics.length).toBeGreaterThan(0);
        await expect(access(join(root, "out"))).rejects.toThrow();
      });
    },
    120_000,
  );

  it("rejects an invalid mode through the built CLI before creating output", async () => {
    await withProfileProject(SOURCE, PROFILE, async (project, root) => {
      const result = await invoke(["build", "--project", project, "--optimization", "fast"], root);
      expect(result.status).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("CLI_INVALID_ARGUMENT");
      await expect(access(join(root, "out"))).rejects.toThrow();
    });
  }, 120_000);
});

describe("complete-cost mode selection", () => {
  // Size minimizes loaded bytes first, so a slower candidate wins. Speed sorts
  // the semantic cycle vector first, so the larger, faster candidate wins.
  it("selects the smaller candidate in size mode and the faster one in speed mode", () => {
    const baseline = candidate("none", cost(140, { main: exact(140) }, { zeroPage: 6 }));
    const smallSlow = candidate("small-slow", cost(100, { main: exact(120) }, { zeroPage: 4 }));
    const largeFast = candidate("large-fast", cost(130, { main: exact(80) }, { zeroPage: 6 }));

    for (const candidates of [
      [largeFast, smallSlow],
      [smallSlow, largeFast],
    ] as const) {
      expect(selectOptimizationCandidate("size", baseline, candidates)).toMatchObject({
        kind: "selected",
        candidateId: "small-slow",
        tieBreak: "none",
      });
      expect(selectOptimizationCandidate("speed", baseline, candidates)).toMatchObject({
        kind: "selected",
        candidateId: "large-fast",
        tieBreak: "none",
      });
    }
  });

  // Balanced accepts only a candidate that is weakly no worse than the baseline
  // and every competitor, with at least one strict improvement.
  it("selects only the no-regression Pareto candidate in balanced mode", () => {
    const baseline = candidate(
      "none",
      cost(140, { main: exact(120) }, { zeroPage: 6, residentRam: 20 }),
    );
    const winner = candidate(
      "pareto-win",
      cost(130, { main: exact(110) }, { zeroPage: 5, residentRam: 18 }),
    );
    const worse = candidate(
      "dominated",
      cost(150, { main: exact(130) }, { zeroPage: 6, residentRam: 20 }),
    );

    expect(selectOptimizationCandidate("balanced", baseline, [worse, winner])).toMatchObject({
      kind: "selected",
      candidateId: "pareto-win",
      tieBreak: "none",
    });
  });

  // A byte/cycle tradeoff has no balanced winner: the byte winner is slower and
  // the cycle winner is larger. Balanced must keep the feasible baseline.
  it("retains the baseline and names the tradeoff components in balanced mode", () => {
    const resources = { zeroPage: 4, residentRam: 40, hardwareStack: 8, scratch: 2 };
    const baseline = candidate(
      "baseline",
      cost(100, { main: exact(100), interrupt: exact(140) }, resources),
    );
    const small = candidate(
      "small",
      cost(80, { main: exact(120), interrupt: exact(160) }, resources),
    );
    const fast = candidate(
      "fast",
      cost(120, { main: exact(70), interrupt: exact(110) }, resources),
    );

    const selection = selectOptimizationCandidate("balanced", baseline, [small, fast]);
    expect(selection.kind).toBe("none");
    if (selection.kind !== "none") throw new Error("Expected balanced to retain the baseline");
    expectTradeoffComponents(selection.incomparableComponents);
  });

  it("selects the byte winner in size mode and the cycle winner in speed mode", () => {
    const resources = { zeroPage: 4, residentRam: 40, hardwareStack: 8, scratch: 2 };
    const baseline = candidate(
      "baseline",
      cost(100, { main: exact(100), interrupt: exact(140) }, resources),
    );
    const small = candidate(
      "small",
      cost(80, { main: exact(120), interrupt: exact(160) }, resources),
    );
    const fast = candidate(
      "fast",
      cost(120, { main: exact(70), interrupt: exact(110) }, resources),
    );

    expect(selectOptimizationCandidate("size", baseline, [fast, small])).toMatchObject({
      kind: "selected",
      candidateId: "small",
      tieBreak: "none",
    });
    expect(selectOptimizationCandidate("speed", baseline, [small, fast])).toMatchObject({
      kind: "selected",
      candidateId: "fast",
      tieBreak: "none",
    });
  });
});

describe("exact ties and incomparable terms", () => {
  const baseline = candidate(
    "reference",
    cost(200, { main: exact(200) }, { zeroPage: 9, residentRam: 90, hardwareStack: 9, scratch: 9 }),
  );
  const alpha = candidate(
    "alpha",
    cost(100, { main: exact(100) }, { zeroPage: 4, residentRam: 40, hardwareStack: 4, scratch: 4 }),
  );
  const zeta = candidate(
    "zeta",
    cost(100, { main: exact(100) }, { zeroPage: 4, residentRam: 40, hardwareStack: 4, scratch: 4 }),
  );

  // Identical complete vectors may be separated only by the stable candidate id,
  // and the result cannot depend on discovery order.
  it.each(COMPARISON_MODES)(
    "resolves an exact complete-cost tie by the smallest stable id in %s mode",
    (mode) => {
      for (const candidates of [
        [zeta, alpha],
        [alpha, zeta],
      ] as const) {
        expect(selectOptimizationCandidate(mode, baseline, candidates)).toMatchObject({
          kind: "selected",
          candidateId: "alpha",
          tieBreak: "stableId",
        });
      }
    },
  );

  // A real cost difference is never decided by candidate identity.
  it("does not let a stable id decide a non-identical cost", () => {
    const small = candidate("zzz", cost(100, { main: exact(100) }, { zeroPage: 4 }));
    const larger = candidate("aaa", cost(101, { main: exact(100) }, { zeroPage: 4 }));

    for (const mode of COMPARISON_MODES) {
      expect(selectOptimizationCandidate(mode, baseline, [larger, small])).toMatchObject({
        kind: "selected",
        candidateId: "zzz",
        tieBreak: "none",
      });
    }
  });

  // An unknown term is not zero, not a win and not an exact tie.
  it("keeps an unknown decisive cycle term incomparable", () => {
    const exactBaseline = cost(10, { main: exact(0) });
    const unknownCost = cost(10, { main: unavailable() });

    expect(compareOptimizationCosts("size", unknownCost, exactBaseline).kind).toBe("incomparable");
    expect(compareOptimizationCosts("size", exactBaseline, unknownCost).kind).toBe("incomparable");
    expect(compareOptimizationCosts("speed", unknownCost, exactBaseline).kind).toBe("incomparable");
    expect(
      compareOptimizationCosts("size", unknownCost, cost(10, { main: unavailable() })).kind,
    ).toBe("incomparable");
  });

  it("does not select an unknown candidate or use a stable-id tie for it", () => {
    const exactBaseline = candidate("exact-baseline", cost(10, { main: exact(0) }));
    const unknownCandidate = candidate("unknown-candidate", cost(10, { main: unavailable() }));
    const unknownTieA = candidate("unknown-a", cost(10, { main: unavailable() }));
    const unknownTieB = candidate("unknown-b", cost(10, { main: unavailable() }));

    expectNoUnknownSelection(
      selectOptimizationCandidate("speed", exactBaseline, [unknownCandidate]),
      ["unknown-candidate"],
    );
    expect(selectOptimizationCandidate("balanced", exactBaseline, [unknownCandidate]).kind).toBe(
      "none",
    );
    expectNoUnknownSelection(
      selectOptimizationCandidate("size", exactBaseline, [unknownTieA, unknownTieB]),
      ["unknown-a", "unknown-b"],
    );
  });

  // Unknown only blocks the comparison when an earlier component has not already
  // decided it; a smaller byte total still wins in size mode.
  it("lets fewer bytes decide before an unknown cycle term", () => {
    const exactBaseline = candidate("exact-baseline", cost(10, { main: exact(10) }));
    const fewerUnknown = candidate("fewer-unknown", cost(9, { main: unavailable() }));

    expect(selectOptimizationCandidate("size", exactBaseline, [fewerUnknown])).toMatchObject({
      kind: "selected",
      candidateId: "fewer-unknown",
      tieBreak: "none",
    });
  });
});

describe("rejected baseline tradeoff", () => {
  // The canonical baseline cannot be used, so no feasible cost exists for it.
  // Only the two feasible candidates remain; neither dominates the other.
  const resources = { zeroPage: 2, residentRam: 20 };
  const feasibleSmall = candidate("feasible-small", cost(90, { main: exact(130) }, resources));
  const feasibleFast = candidate("feasible-fast", cost(110, { main: exact(70) }, resources));

  it("reports no balanced winner and names both tradeoff components", () => {
    const selection = selectOptimizationCandidate("balanced", feasibleSmall, [feasibleFast]);
    expect(selection.kind).toBe("none");
    if (selection.kind !== "none") throw new Error("Expected no balanced winner");
    expectTradeoffComponents(selection.incomparableComponents);
  });

  it("lets speed and size select their respective feasible candidate", () => {
    expect(selectOptimizationCandidate("speed", feasibleSmall, [feasibleFast])).toMatchObject({
      kind: "selected",
      candidateId: "feasible-fast",
      tieBreak: "none",
    });
    expect(selectOptimizationCandidate("size", feasibleFast, [feasibleSmall])).toMatchObject({
      kind: "selected",
      candidateId: "feasible-small",
      tieBreak: "none",
    });
  });

  // Both explicit goals must still publish a complete artifact after selection.
  it.each(["speed", "size"] as const)(
    "publishes a complete artifact in %s mode",
    async (mode) => {
      await withProfileProject(SOURCE, PROFILE, async (project) => {
        const built = await buildWithMode(project, mode);
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (!isBuildSuccess(built)) throw new Error("Expected a complete build");
        await expectPublished(built, mode);
      });
    },
    120_000,
  );
});

describe("deterministic selection and evidence", () => {
  // Repeating selection with a different candidate discovery order must not
  // change the selected identity or the incomparability result.
  it.each(COMPARISON_MODES)("repeats %s selection independently of candidate order", (mode) => {
    const baseline = candidate(
      "baseline",
      cost(
        140,
        { main: exact(120) },
        { zeroPage: 6, residentRam: 60, hardwareStack: 6, scratch: 3 },
      ),
    );
    const small = candidate(
      "small",
      cost(
        100,
        { main: exact(120) },
        { zeroPage: 4, residentRam: 40, hardwareStack: 4, scratch: 2 },
      ),
    );
    const fast = candidate(
      "fast",
      cost(
        130,
        { main: exact(80) },
        { zeroPage: 7, residentRam: 70, hardwareStack: 7, scratch: 4 },
      ),
    );
    const middle = candidate(
      "middle",
      cost(
        115,
        { main: exact(100) },
        { zeroPage: 5, residentRam: 50, hardwareStack: 5, scratch: 3 },
      ),
    );
    const candidates = [small, fast, middle] as const;

    const first = selectOptimizationCandidate(mode, baseline, candidates);
    const reversed = selectOptimizationCandidate(mode, baseline, [...candidates].reverse());
    const rotated = selectOptimizationCandidate(mode, baseline, [middle, small, fast]);
    expect(reversed).toEqual(first);
    expect(rotated).toEqual(first);
  });

  // Two clean builds of the same source must publish identical portable
  // selection records and identical primary artifact bytes.
  it.each(["balanced", "speed"] as const)(
    "publishes identical portable evidence for two %s builds",
    async (mode) => {
      const cleanBuild = () =>
        withProfileProject(SOURCE, PROFILE, async (project) => {
          const built = await buildWithMode(project, mode);
          expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
          if (!isBuildSuccess(built)) throw new Error("Expected a complete build");
          return readProfileArtifacts(built);
        });

      const first = await cleanBuild();
      const second = await cleanBuild();
      expect(first.costs).toEqual(second.costs);
      expect(first.prg).toEqual(second.prg);
      expect(first.build.semanticInputs).toEqual(second.build.semanticInputs);
      expect(first.build.portableTools).toEqual(second.build.portableTools);
      expect(first.build.artifacts).toEqual(second.build.artifacts);
    },
    180_000,
  );
});
