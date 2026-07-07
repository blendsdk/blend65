/**
 * Implementation tests — edge cases & internals for `assembleProgram` +
 * the entry-label/sanitize mapping. These complement the spec tests
 * (`assemble.spec.test.ts`): they are derived from the implementation's documented
 * internals, not from the spec oracles.
 *
 *   - `programByteSize` counts the populated preamble (not just the streams).
 *   - `derivePreambleOptions` sets `needsDataInit` true iff the program has const
 *     data (observed through a recording fake plugin).
 *   - a multi-function program sanitizes every non-entry function label.
 *   - a function literally named `main` in a NON-`Main` module still maps to `_main`.
 *
 * Codegen tests use only codegen's dependency closure — the `PlatformPlugin`
 * here is a minimal inline fake (the type lives in `@blend65/core`), never the real
 * `@blend65/platforms` plugin (which would form a build cycle).
 */

import { describe, expect, it, vi } from "vitest";
import { createDiagnosticBag } from "@blend65/core";
import type { AllocationPlan } from "@blend65/core";
import type {
  AcmeDirective,
  MainTerminationPolicy,
  PlatformPlugin,
  PlatformProfile,
  PreambleOptions,
  ShimVariant,
  StreamEntry,
  ValidationError,
} from "@blend65/core/platform";
import { directive, isLabel } from "@blend65/core/platform";

import type { ConstDataEntry, ILFunction, ILProgram } from "../il/cfg.js";
import { lowerToIL } from "../il/lower.js";
import { gateFixture } from "../il/test-fixtures.js";
import { instrByteSize } from "./print-instr.js";
import { assembleProgram, generateInstr, programByteSize } from "./instr-program.js";

/** A minimal `AllocationPlan` sufficient for translating temp-free functions. */
function emptyPlan(): AllocationPlan {
  return {
    frames: new Map(),
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

/** A void single-block function that lowers to a bare `RTS` under the given fqName. */
function voidFn(name: string): ILFunction {
  return {
    name,
    params: [],
    returnType: "void",
    blocks: [{ label: "_entry", instructions: [], terminator: { kind: "ret" } }],
    tempCount: 0,
    isInterrupt: false,
  };
}

/** Assemble an `ILProgram` from functions + optional const data. */
function programOf(functions: ILFunction[], constData: readonly ConstDataEntry[] = []): ILProgram {
  return { functions, initCode: [], constData, allocationPlan: emptyPlan() };
}

const fakeProfile = { cpu: "nmos6502" } as unknown as PlatformProfile;

/** A one-entry preamble (a single non-zero-byte directive) the fake plugin emits. */
function fakePreamble(): StreamEntry[] {
  return [directive({ kind: "byte", values: [0x9e] })];
}

/** Build a fake plugin around the given `emitPreamble` (defaults to {@link fakePreamble}). */
function makeFakePlugin(emitPreamble: (o: PreambleOptions) => StreamEntry[]): PlatformPlugin {
  return {
    id: "fake",
    displayName: "Fake Test Platform",
    profile: fakeProfile,
    intrinsics: [],
    runtimeModules: [],
    emitPreamble,
    emitStartupShim: (_v: ShimVariant): StreamEntry[] => [],
    getOutputDirective: (n: string): AcmeDirective => ({
      kind: "outputFile",
      name: `${n}.prg`,
      format: "cbm",
    }),
    encodeString: (t: string): number[] => [...t].map((c) => c.charCodeAt(0)),
    encodeChar: (c: string): number => c.charCodeAt(0),
    getMainTerminationPolicy: (): MainTerminationPolicy => ({ canReturn: true }),
    validateProfile: (): ValidationError[] => [],
  };
}

describe("assembleProgram — implementation edge cases", () => {
  it("programByteSize counts the populated preamble, not just the streams", () => {
    const bag = createDiagnosticBag();
    const il = lowerToIL(gateFixture, bag);

    const plugin = makeFakePlugin(() => fakePreamble());
    const assembled = assembleProgram(il, plugin, bag);
    const preambleBytes = assembled.preamble.reduce((n, e) => n + instrByteSize(e), 0);
    const streamBytes = assembled.streams
      .flatMap((s) => s.entries)
      .reduce((n, e) => n + instrByteSize(e), 0);

    // The preamble carries real bytes, so the assembled size strictly exceeds a
    // stream-only count by exactly the preamble bytes.
    expect(preambleBytes).toBeGreaterThan(0);
    expect(programByteSize(assembled)).toBe(preambleBytes + streamBytes);
  });

  it("sets needsDataInit true iff the program carries const data", () => {
    // A recording fake captures the options `assembleProgram` derives + passes.
    const seen: PreambleOptions[] = [];
    const plugin = makeFakePlugin((options) => {
      seen.push(options);
      return fakePreamble();
    });

    const constEntry: ConstDataEntry = {
      symbol: "__data_x",
      data: new Uint8Array([1, 2, 3]),
      type: "array",
    };

    assembleProgram(programOf([voidFn("Main.main")]), plugin, createDiagnosticBag());
    assembleProgram(programOf([voidFn("Main.main")], [constEntry]), plugin, createDiagnosticBag());

    expect(seen).toHaveLength(2);
    expect(seen[0]?.needsDataInit).toBe(false); // no const data
    expect(seen[1]?.needsDataInit).toBe(true); // const data present
  });

  it("derives the Half-A shim options (terminating, no BSS zero)", () => {
    const seen: PreambleOptions[] = [];
    const plugin = makeFakePlugin((options) => {
      seen.push(options);
      return fakePreamble();
    });
    assembleProgram(programOf([voidFn("Main.main")]), plugin, createDiagnosticBag());

    expect(seen[0]?.shimVariant).toBe("terminating");
    expect(seen[0]?.needsBssZero).toBe(false);
    expect(seen[0]?.projectName).toBe("main");
  });

  it("sanitizes every non-entry function label in a multi-function program", () => {
    const program = programOf([voidFn("Math.add"), voidFn("Util.helper")]);
    const out = generateInstr(program, "nmos6502", createDiagnosticBag());

    const labels = out.streams.map((s) => {
      const first = s.entries[0];
      return first !== undefined && isLabel(first) ? first.name : undefined;
    });
    expect(labels).toEqual(["Math_add", "Util_helper"]);
  });

  it("maps a `main` function in a non-`Main` module to `_main` too", () => {
    // The entry point is identified by the bare name `main`, regardless of module.
    const program = programOf([voidFn("Game.main")]);
    const out = generateInstr(program, "nmos6502", createDiagnosticBag());

    const first = out.streams[0]?.entries[0];
    expect(first !== undefined && isLabel(first)).toBe(true);
    if (first !== undefined && isLabel(first)) {
      expect(first.name).toBe("_main");
    }
  });

  it("invokes the plugin's emitPreamble exactly once per assemble", () => {
    const spy = vi.fn((_o: PreambleOptions) => fakePreamble());
    const plugin = makeFakePlugin(spy);
    assembleProgram(programOf([voidFn("Main.main")]), plugin, createDiagnosticBag());
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
