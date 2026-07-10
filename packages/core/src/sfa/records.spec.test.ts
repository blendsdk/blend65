/**
 * Specification tests for the core SFA record vocabulary.
 *
 * Derived exclusively from the documented record contracts — NOT from
 * implementation logic — covering the input records (`FunctionInfo`, `FrameVar`),
 * the frame records (`FunctionFrame`, `FrameSlot`, `InterferenceGraph`), the
 * zero-page and layout records (`ModuleVariableAllocation`, `ZpAllocation`,
 * profile budgets), the stack-analysis record (`StackAnalysis`), and the
 * allocation-plan records (`AllocationPlan`, `FrameAllocation`,
 * `SymbolDefinition`, `SfaResourceData`).
 *
 * These are *shape/contract* spec tests: they construct each record from the
 * documented field set and assert the field values round-trip, and they assert
 * the interim `PlatformProfile` budget fields exist and are typed `number`. The
 * expectations come from the specification, not the code (immutable oracle).
 *
 * Spec-tests-first: authored before the implementation; verified to FAIL (red)
 * before the records exist.
 */

import { describe, expect, it } from "vitest";
import { primitive } from "../index.js";
import type {
  FrameVar,
  FunctionInfo,
  FrameSlot,
  FunctionFrame,
  InterferenceGraph,
  ModuleVariableAllocation,
  ZpAllocation,
  StackAnalysis,
  FrameAllocation,
  SymbolDefinition,
  SfaResourceData,
  AllocationPlan,
  PlatformProfile,
} from "../index.js";

describe("Specification: RD-05 core SFA records", () => {
  // FrameVar / FunctionInfo
  it("should construct a FunctionInfo with FrameVar parameters/locals and flags", () => {
    const dx: FrameVar = { name: "dx", type: primitive("sword"), byRef: false };
    const i: FrameVar = { name: "i", type: primitive("byte"), byRef: false };
    const fn: FunctionInfo = {
      name: "Game.update",
      parameters: [dx],
      locals: [i],
      isInterrupt: false,
      isEscaped: false,
      isReachable: true,
      callees: ["Game.moveEnemies"],
      argWindowInterferes: [],
    };

    expect(fn.name).toBe("Game.update");
    expect(fn.parameters[0]?.name).toBe("dx");
    expect(fn.parameters[0]?.byRef).toBe(false);
    expect(fn.locals[0]?.name).toBe("i");
    expect(fn.isReachable).toBe(true);
    expect(fn.callees).toEqual(["Game.moveEnemies"]);
  });

  // FrameSlot / FunctionFrame
  it("should construct a FunctionFrame with ordered FrameSlots and totalSize", () => {
    const slot0: FrameSlot = {
      name: "dx",
      kind: "parameter",
      type: primitive("sword"),
      size: 2,
      offset: 0,
    };
    const slot1: FrameSlot = {
      name: "i",
      kind: "local",
      type: primitive("byte"),
      size: 1,
      offset: 2,
    };
    const frame: FunctionFrame = {
      functionName: "Game.update",
      slots: [slot0, slot1],
      totalSize: 3,
      isInterrupt: false,
      isEscaped: false,
      isReachable: true,
    };

    expect(frame.slots).toHaveLength(2);
    expect(frame.slots[0]?.kind).toBe("parameter");
    expect(frame.slots[1]?.kind).toBe("local");
    expect(frame.totalSize).toBe(3);
  });

  // InterferenceGraph
  it("should construct an InterferenceGraph with nodes and symmetric edges", () => {
    const graph: InterferenceGraph = {
      nodes: new Set(["a", "b"]),
      edges: new Map([
        ["a", new Set(["b"])],
        ["b", new Set(["a"])],
      ]),
    };

    expect(graph.nodes.has("a")).toBe(true);
    expect(graph.edges.get("a")?.has("b")).toBe(true);
  });

  // ModuleVariableAllocation / ZpAllocation
  it("should construct a ModuleVariableAllocation", () => {
    const mv: ModuleVariableAllocation = {
      moduleName: "Game",
      variableName: "score",
      address: 0x0800,
      offset: 0,
      size: 2,
      type: primitive("word"),
    };

    expect(mv.address).toBe(0x0800);
    expect(mv.size).toBe(2);
  });

  it("should construct ZpAllocation records for each category", () => {
    const user: ZpAllocation = {
      name: "rasterLine",
      address: 0x02,
      size: 1,
      category: "user",
    };
    const ptr: ZpAllocation = {
      name: "__zp_ptr_0",
      address: 0x03,
      size: 2,
      category: "pointer",
    };
    const argBlock: ZpAllocation = {
      name: "__zp_arg_0",
      address: 0x02,
      size: 1,
      category: "arg-block",
    };

    expect(user.category).toBe("user");
    expect(ptr.category).toBe("pointer");
    // the "arg-block" category stays plumbed even though the interim floor is 0.
    expect(argBlock.category).toBe("arg-block");
  });

  // StackAnalysis
  it("should construct a StackAnalysis record", () => {
    const stack: StackAnalysis = {
      maxMainDepth: 3,
      maxMainStackBytes: 6,
      maxIrqDepth: 2,
      maxIrqStackBytes: 4,
      irqOverhead: 6,
      totalWorstCase: 16,
      platformBudget: 230,
      exceedsWarningThreshold: false,
    };

    expect(stack.totalWorstCase).toBe(16);
    expect(stack.exceedsWarningThreshold).toBe(false);
  });

  // FrameAllocation / SymbolDefinition / SfaResourceData
  it("should construct a FrameAllocation", () => {
    const slot: FrameSlot = {
      name: "x",
      kind: "local",
      type: primitive("byte"),
      size: 1,
      offset: 0,
    };
    const frame: FunctionFrame = {
      functionName: "M.f",
      slots: [slot],
      totalSize: 1,
      isInterrupt: false,
      isEscaped: false,
      isReachable: true,
    };
    const fa: FrameAllocation = {
      functionName: "M.f",
      frame,
      offset: 0,
      absoluteAddress: 0x0800,
    };

    expect(fa.absoluteAddress).toBe(0x0800);
    expect(fa.frame.totalSize).toBe(1);
  });

  it("should construct a SymbolDefinition", () => {
    const sym: SymbolDefinition = { name: "__frame_Game_update", value: 0x0810 };
    expect(sym.name).toBe("__frame_Game_update");
    expect(sym.value).toBe(0x0810);
  });

  it("should construct an SfaResourceData record with all budget fields", () => {
    const rd: SfaResourceData = {
      frameRegionBytes: 8,
      frameRegionPeak: 8,
      frameSharingSaved: 4,
      zpUsed: 9,
      zpBudget: 46,
      ramUsed: 16,
      ramBudget: 0x9800,
      stackWorstCase: 16,
      stackBudget: 230,
    };

    expect(rd.frameRegionPeak).toBe(rd.frameRegionBytes);
    expect(rd.zpBudget).toBe(46);
  });

  it("should construct an immutable AllocationPlan with all sub-records", () => {
    const plan: AllocationPlan = {
      frames: new Map(),
      dataBase: 0x0800,
      frameRegionBase: 0x0800,
      frameRegionSize: 0,
      peakSimultaneous: 0,
      sharingSaved: 0,
      zpAllocations: [],
      zpUsed: 0,
      zpBudget: 46,
      moduleVariables: [],
      moduleVariablesSize: 0,
      stackAnalysis: {
        maxMainDepth: 0,
        maxMainStackBytes: 0,
        maxIrqDepth: 0,
        maxIrqStackBytes: 0,
        irqOverhead: 0,
        totalWorstCase: 0,
        platformBudget: 230,
        exceedsWarningThreshold: false,
      },
      symbolDefinitions: [],
      resourceData: {
        frameRegionBytes: 0,
        frameRegionPeak: 0,
        frameSharingSaved: 0,
        zpUsed: 0,
        zpBudget: 46,
        ramUsed: 0,
        ramBudget: 0x9800,
        stackWorstCase: 0,
        stackBudget: 230,
      },
      hasErrors: false,
    };

    expect(plan.frameRegionBase).toBe(0x0800);
    expect(plan.peakSimultaneous).toBe(plan.frameRegionSize);
    expect(plan.hasErrors).toBe(false);
  });
});

describe("Specification: RD-05 interim PlatformProfile budget fields (D2/D8)", () => {
  // Interim budget fields; the C64 fixture values used here: ramStart 0x0800,
  // ramEnd 0xA000, zpStart 0x02, zpEnd 0x2F, stackBudget 230, zpArgBlockMin 0,
  // mainTempBytes 4, irqTempBytes 2, thresholds 0.80/0.90/0.75.
  it("should expose all interim SFA budget fields on PlatformProfile", () => {
    const profile: PlatformProfile = {
      name: "c64",
      charEncoding: "petscii",
      ramStart: 0x0800,
      ramEnd: 0xa000,
      zpStart: 0x02,
      zpEnd: 0x2f,
      stackBudget: 230,
      zpArgBlockMin: 0,
      mainTempBytes: 4,
      irqTempBytes: 2,
      zpWarnThreshold: 0.8,
      ramWarnThreshold: 0.9,
      stackWarnThreshold: 0.75,
    };

    // Budget convention: zpBudget is inclusive, ramBudget is half-open.
    expect(profile.zpEnd - profile.zpStart + 1).toBe(46);
    expect(profile.ramEnd - profile.ramStart).toBe(0x9800);
    // This spec fixture's arg-block floor is 0, distinct from the shipped
    // production default.
    expect(profile.zpArgBlockMin).toBe(0);
    expect(profile.mainTempBytes).toBe(4);
    expect(profile.irqTempBytes).toBe(2);
    expect(profile.zpWarnThreshold).toBeCloseTo(0.8);
    expect(profile.ramWarnThreshold).toBeCloseTo(0.9);
    expect(profile.stackWarnThreshold).toBeCloseTo(0.75);
  });
});
