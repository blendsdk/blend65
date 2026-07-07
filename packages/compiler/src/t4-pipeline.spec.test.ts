/**
 * Specification test for the T4 (import pseudo-module) clean path through the
 * pipeline.
 *
 * Written from the requirement, never from the implementation:
 * `import { fix_probe } from c64;` + `fix_probe();` analyzes clean, lowers and
 * translates to a `JSR fix_probe`, and the fixture's `.asm` module is embedded
 * (exactly once) in the serialized runtime section.
 *
 * Placement: this pipeline test lives in `@blend65/compiler` per the
 * package-boundary rule (the integration layer that already depends on
 * frontend + codegen + platforms). The fixture is compiler-local (test-local
 * factories are allowed here); `baseUrl` points at this test module so the
 * module resolves from `src/` and `dist/` identically.
 */

import { describe, expect, it } from "vitest";
import {
  createDiagnosticBag,
  createIntrinsicRegistry,
  DEFAULT_PROFILE,
  RT_ROUTINES,
} from "@blend65/core";
import type { AllocationPlan, FrameAllocation, IntrinsicDescriptor } from "@blend65/core";
import type { PlatformPlugin } from "@blend65/core/platform";
import { analyze, lex, parse } from "@blend65/frontend";
import {
  assembleProgram,
  buildRuntimeSection,
  collectReferencedRoutines,
  lowerToIL,
  serializeToAcme,
} from "@blend65/codegen";
import { c64Plugin } from "@blend65/platforms";

const SRC = 1;

/** Compiler-local T4 fixture descriptor (a test-local factory). */
const FIX_PROBE: IntrinsicDescriptor = {
  name: "fix_probe",
  tier: "T4",
  signature: { params: [], returnType: "void" },
  availability: () => true, // platform gating comes from the merge wrapper
  loweringStrategy: "call",
  costMetadata: { cycles: "varies", bytes: "varies", zpBytes: 0 },
  clobberList: ["A", "status"],
  description: "test fixture",
};

/** The compiler-local fixture plugin: c64 + the T4 contribution (resolved via `baseUrl`). */
const fixturePlugin: PlatformPlugin = {
  ...c64Plugin,
  intrinsics: [FIX_PROBE],
  runtimeModules: [
    {
      name: "fix-probe",
      asmPath: "../__fixtures__/fix-probe.asm",
      exports: ["fix_probe"],
      baseUrl: import.meta.url,
    },
  ],
};

/** A minimal plan carrying the entry function's (empty) frame. */
function planOf(): AllocationPlan {
  const frame: FrameAllocation = {
    functionName: "Main.main",
    frame: {
      functionName: "Main.main",
      slots: [],
      totalSize: 0,
      isInterrupt: false,
      isEscaped: false,
      isReachable: true,
    },
    offset: 0,
    absoluteAddress: 0,
  };
  return {
    frames: new Map([["Main.main", frame]]),
    frameRegionBase: 0,
    frameRegionSize: 0,
    peakSimultaneous: 0,
    sharingSaved: 0,
    zpAllocations: [],
    zpUsed: 0,
    zpBudget: 256,
    moduleVariables: [],
    moduleVariablesSize: 0,
    stackAnalysis: {
      maxMainDepth: 0,
      maxMainStackBytes: 0,
      maxIrqDepth: 0,
      maxIrqStackBytes: 0,
      irqOverhead: 0,
      totalWorstCase: 0,
      platformBudget: 256,
      exceedsWarningThreshold: false,
    },
    symbolDefinitions: [],
    resourceData: {
      frameRegionBytes: 0,
      frameRegionPeak: 0,
      frameSharingSaved: 0,
      zpUsed: 0,
      zpBudget: 256,
      ramUsed: 0,
      ramBudget: 0,
      stackWorstCase: 0,
      stackBudget: 256,
    },
    hasErrors: false,
  };
}

describe("Specification: RD-17 T4 clean path through the pipeline (ST-32, AC-05/AC-16)", () => {
  it("import + call analyzes clean, emits JSR fix_probe, and embeds the fixture module once", () => {
    const source =
      `module Main;\n` +
      `import { fix_probe } from c64;\n` +
      `function main(): void { fix_probe(); }\n`;
    const bag = createDiagnosticBag();
    const registry = createIntrinsicRegistry(fixturePlugin.intrinsics, fixturePlugin.id);

    // Analyze (clean: import present, owning platform targeted).
    const { tokens } = lex(SRC, source, bag);
    const { ast } = parse({ tokens, source, sourceId: SRC, bag });
    const model = analyze({
      programs: [ast],
      bag,
      profile: DEFAULT_PROFILE,
      registry,
      targetProfile: fixturePlugin.profile,
    });
    expect(bag.getAll().filter((d) => d.code.startsWith("E1"))).toEqual([]);

    // Lower → translate → serialize with the runtime section.
    const il = lowerToIL({ program: [ast], model, plan: planOf(), registry }, bag);
    const program = assembleProgram(il, fixturePlugin, bag);
    const referenced = collectReferencedRoutines(
      program,
      [...RT_ROUTINES, ...fixturePlugin.intrinsics],
      fixturePlugin.runtimeModules,
    );
    expect([...referenced]).toEqual(["fix_probe"]);
    const section = buildRuntimeSection(referenced, RT_ROUTINES, fixturePlugin.runtimeModules);
    const text = serializeToAcme(program, { runtimeSection: section ?? "" });

    // The call site and the embedded module (exactly one definition).
    expect(text).toMatch(/JSR fix_probe/i);
    expect(text.split("\n").filter((line) => line.startsWith("fix_probe:"))).toHaveLength(1);
    expect(bag.getAll().filter((d) => d.code.startsWith("E9"))).toEqual([]);
  });
});
