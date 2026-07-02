/**
 * Implementation tests for RD-17 runtime embedding internals (03-04, 4.3.1):
 * symbol collection edges, the path-traversal guard, `__zp_arg_N` reference
 * correctness (PF-018), and deterministic section ordering.
 */

import { describe, expect, it } from "vitest";
import { RT_ROUTINES } from "@blend65/core";
import type { AllocationPlan, IntrinsicDescriptor } from "@blend65/core";
import type { InstrProgram } from "../instr/instr-program.js";
import type { InstrStream } from "../instr/stream.js";
import { instr, label } from "../instr/stream.js";
import { labelRef, none } from "../instr/operand.js";
import {
  RUNTIME_SECTION_HEADER,
  buildRuntimeSection,
  collectReferencedRoutines,
  loadRuntimeModule,
} from "./embed.js";

/** A minimal allocation plan carrier for hand-built programs. */
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

/** Wrap streams into a frozen program shape. */
function programOf(...streams: InstrStream[]): InstrProgram {
  return { preamble: [], streams, allocationPlan: emptyPlan() };
}

/** A code stream containing the given entries. */
function codeStream(entries: InstrStream["entries"]): InstrStream {
  return { symbol: "M.f", segment: "code", entries };
}

/** A fixture descriptor with a controllable asmModulePath. */
function fixture(name: string, asmModulePath: string | undefined): IntrinsicDescriptor {
  return {
    name,
    tier: "T3",
    signature: { params: [], returnType: "void" },
    availability: () => true,
    loweringStrategy: "call",
    costMetadata: { cycles: "varies", bytes: "varies", zpBytes: 0 },
    clobberList: [],
    description: "fixture",
    ...(asmModulePath !== undefined ? { asmModulePath } : {}),
  };
}

describe("collectReferencedRoutines — collection edges", () => {
  it("collects each referenced routine once, ignoring repeats and unknown JSR targets", () => {
    const program = programOf(
      codeStream([
        label("M.f"),
        instr("JSR", "Absolute", labelRef("__rt_mul8")),
        instr("JSR", "Absolute", labelRef("__rt_mul8")), // repeat → one entry
        instr("JSR", "Absolute", labelRef("someUserFn")), // unknown → ignored
        instr("RTS", "Implied", none()),
      ]),
      codeStream([label("M.g"), instr("JSR", "Absolute", labelRef("__rt_div16"))]),
    );
    const referenced = collectReferencedRoutines(program, RT_ROUTINES);
    expect([...referenced].sort()).toEqual(["__rt_div16", "__rt_mul8"]);
  });

  it("ignores non-JSR instructions referencing routine-like labels", () => {
    const program = programOf(
      codeStream([instr("LDA", "Absolute", labelRef("__rt_mul8")), instr("RTS", "Implied", none())]),
    );
    expect(collectReferencedRoutines(program, RT_ROUTINES).size).toBe(0);
  });

  it("descriptors without asmModulePath are never collected (nothing to embed)", () => {
    const noModule = fixture("__rt_ghost", undefined);
    const program = programOf(codeStream([instr("JSR", "Absolute", labelRef("__rt_ghost"))]));
    expect(collectReferencedRoutines(program, [noModule]).size).toBe(0);
  });
});

describe("loadRuntimeModule — path guard (security)", () => {
  it("rejects an absolute asmModulePath", () => {
    expect(() => loadRuntimeModule(fixture("__rt_abs", "/etc/passwd"))).toThrow(/absolute/);
  });

  it("rejects a traversal path escaping the package root", () => {
    expect(() => loadRuntimeModule(fixture("__rt_esc", "../core/package.json"))).toThrow(/escapes/);
  });

  it("rejects a descriptor without asmModulePath", () => {
    expect(() => loadRuntimeModule(fixture("__rt_none", undefined))).toThrow(/no asmModulePath/);
  });
});

describe("runtime modules — __zp_arg_N reference correctness (PF-018)", () => {
  it("modules reference only the guaranteed __zp_arg_0..3 symbols and define none", () => {
    for (const d of RT_ROUTINES) {
      const text = loadRuntimeModule(d);
      const refs = [...text.matchAll(/__zp_arg_(\d+)/g)].map((m) => Number(m[1]));
      // Only the validated floor (R35: zpArgBlockSize >= 4) is ever referenced.
      for (const n of refs) {
        expect(n, `${d.name} references __zp_arg_${n}`).toBeLessThanOrEqual(3);
      }
      // No module defines a symbol (`name = value`) — the program header owns them.
      const defs = text.split("\n").filter((line) => /^__zp_arg_\d+\s*=/.test(line));
      expect(defs, `${d.name} must not define __zp_arg symbols`).toHaveLength(0);
    }
  });

  it("word routines use the arg block; byte routines take register args (AR-33)", () => {
    for (const d of RT_ROUTINES) {
      const usesArgBlock = loadRuntimeModule(d).includes("__zp_arg_0");
      // All four use arg-block bytes (word args or documented scratch); the
      // DECLARED zpBytes counts only marshalled argument bytes.
      expect(usesArgBlock).toBe(true);
      const expected = d.name.endsWith("16") ? 2 : 0;
      expect(d.costMetadata.zpBytes, `${d.name} declared arg bytes`).toBe(expected);
    }
  });
});

describe("buildRuntimeSection — ordering & composition", () => {
  it("orders embedded modules by catalog order regardless of reference order", () => {
    const referenced = new Set(["__rt_div16", "__rt_mul8"]); // reversed vs catalog
    const section = buildRuntimeSection(referenced, RT_ROUTINES);
    expect(section).not.toBeNull();
    const mulAt = section?.indexOf("__rt_mul8:") ?? -1;
    const divAt = section?.indexOf("__rt_div16:") ?? -1;
    expect(mulAt).toBeGreaterThanOrEqual(0);
    expect(divAt).toBeGreaterThan(mulAt); // catalog order: mul8 before div16
    expect(section?.startsWith(RUNTIME_SECTION_HEADER)).toBe(true);
  });

  it("returns null for an empty reference set", () => {
    expect(buildRuntimeSection(new Set(), RT_ROUTINES)).toBeNull();
  });
});
