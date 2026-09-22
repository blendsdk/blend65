import { describe, expect, it } from "vitest";
import { machineInstruction, machineState } from "../machine/lower-control.js";
import type { MachineProgram } from "../machine/machine-types.js";
import type { StorageClosureCertificate } from "../storage/storage-types.js";
import { selectTargetProfile } from "../target/profile.js";
import { layoutC64Program } from "./c64-layout.js";
import { createC64Startup } from "./startup.js";

function selectedProfile() {
  const result = selectTargetProfile("c64-pal-prg-kernal-6581");
  if (result.kind !== "complete") throw new Error("Expected selected profile");
  return result.profile;
}

function certificate(address = 0xc000): StorageClosureCertificate {
  return Object.freeze({
    inventoryHash: "inventory",
    graphHash: "graph",
    profileId: "c64-pal-prg-kernal-6581",
    homes: Object.freeze([
      Object.freeze({ requestId: "home", address, bytes: 2, region: "ram" as const }),
    ]),
    interference: Object.freeze([]),
    helperCalls: Object.freeze([]),
    staticBytes: Object.freeze({ ram: 2, zeroPage: 0 }),
    peakBytes: Object.freeze({ ram: 2, zeroPage: 0 }),
    hardwareStackPeak: 6,
    closed: true,
  });
}

function program(assetBytes: readonly number[]): MachineProgram {
  const startup = createC64Startup({
    initializerLabels: Object.freeze([]),
    mainLabel: "main",
    profile: selectedProfile(),
  });
  if (startup.kind !== "complete") throw new Error("Expected startup");
  return Object.freeze({
    functions: Object.freeze([]),
    data: Object.freeze([
      Object.freeze({
        id: "asset:sprites",
        kind: "asset",
        assetId: "sprites",
        alignment: 64,
        bytes: Object.freeze(assetBytes),
      }),
    ]),
    startup: startup.startup,
    requiredStorage: Object.freeze([]),
  });
}

describe("C64 layout hardening", () => {
  it("should reject an asset that cannot consist of complete 64-byte records", () => {
    const result = layoutC64Program({
      program: program(new Array<number>(65).fill(1)),
      certificate: certificate(),
      profile: selectedProfile(),
    });

    expect(result).toEqual({ kind: "error", reason: "invalid-asset", objectId: "asset:sprites" });
  });

  it("should reject a final SFA home that overlaps loaded startup code", () => {
    const result = layoutC64Program({
      program: program(new Array<number>(64).fill(1)),
      certificate: certificate(0x080d),
      profile: selectedProfile(),
    });

    expect(result).toEqual({ kind: "error", reason: "sfa-conflict", objectId: "home" });
  });

  it("should derive one VIC block per record without copying the asset", () => {
    const bytes = Object.freeze(Array.from({ length: 128 }, (_, index) => index & 0xff));
    const result = layoutC64Program({
      program: program(bytes),
      certificate: certificate(),
      profile: selectedProfile(),
    });

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected layout");
    expect(result.spriteBlocks).toEqual([0x80, 0x81]);
    expect(result.intervals.find(({ id }) => id === "asset:sprites")?.bytes).toEqual(bytes);
    expect(result.intervals.filter(({ id }) => id === "asset:sprites")).toHaveLength(1);
  });

  it("should accept a certified noninterfering SFA overlay as one occupied union", () => {
    const base = certificate();
    const overlaid = Object.freeze({
      ...base,
      homes: Object.freeze([
        Object.freeze({ requestId: "left", address: 0xc000, bytes: 2, region: "ram" as const }),
        Object.freeze({ requestId: "right", address: 0xc000, bytes: 1, region: "ram" as const }),
      ]),
      staticBytes: Object.freeze({ ram: 2, zeroPage: 0 }),
    });
    const result = layoutC64Program({
      program: program(new Array<number>(64).fill(1)),
      certificate: overlaid,
      profile: selectedProfile(),
    });

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected overlay layout");
    expect(result.intervals.filter(({ kind }) => kind === "sfa")).toEqual([
      expect.objectContaining({ start: 0xc000, end: 0xc001 }),
    ]);
  });

  it("should write and restore processor and CIA2 latches before their direction registers", () => {
    const startup = createC64Startup({
      initializerLabels: Object.freeze(["init.one"]),
      mainLabel: "main",
      profile: selectedProfile(),
    });
    if (startup.kind !== "complete") throw new Error("Expected startup");
    const entry = startup.startup.blocks[0]!.instructions;
    const restore = startup.startup.blocks[1]!.instructions;
    const access = (opcode: string, address: number) =>
      entry.findIndex(
        (instruction) =>
          instruction.opcode === opcode &&
          instruction.operand?.kind === "absolute" &&
          instruction.operand.value === address,
      );

    expect(access("sta", 0x0001)).toBeLessThan(access("sta", 0x0000));
    expect(access("sta", 0xdd00)).toBeLessThan(access("sta", 0xdd02));
    const restoreWrite = (address: number) =>
      restore.findIndex(
        (instruction) =>
          instruction.opcode === "sta" &&
          instruction.operand?.kind === "absolute" &&
          instruction.operand.value === address,
      );
    expect(restoreWrite(0x0001)).toBeLessThan(restoreWrite(0x0000));
    expect(restoreWrite(0xdd00)).toBeLessThan(restoreWrite(0xdd02));
    expect(access("lda", 0xdd02)).toBeGreaterThanOrEqual(0);
    expect(access("sta", 0xdd02)).toBeGreaterThanOrEqual(0);
    expect(
      entry
        .filter(
          ({ operand }) =>
            operand?.kind === "absolute" && (operand.value === 0 || operand.value === 1),
        )
        .every(({ mode }) => mode === "zero-page"),
    ).toBe(true);
    expect(selectedProfile().storage.startupStackBytes).toBe(0);
  });

  it("should assign exact function/block origins and repair branches during final layout", () => {
    const base = program(new Array<number>(64).fill(1));
    const profile = selectedProfile();
    const branch = Object.freeze({
      id: "main",
      blocks: Object.freeze([
        Object.freeze({
          label: "entry",
          instructions: Object.freeze([]),
          terminator: Object.freeze({
            kind: "branch" as const,
            opcode: "beq",
            target: "target",
            fallthrough: "padding",
            uses: machineState([], ["z"]),
            cost: Object.freeze({ bytes: 2, minCycles: 2, maxCycles: 4 }),
          }),
        }),
        Object.freeze({
          label: "padding",
          instructions: Object.freeze(
            Array.from({ length: 130 }, () =>
              machineInstruction(profile.cpu, "nop", "implied", null),
            ),
          ),
          terminator: Object.freeze({ kind: "fallthrough" as const, target: "target" }),
        }),
        Object.freeze({
          label: "target",
          instructions: Object.freeze([]),
          terminator: Object.freeze({ kind: "return" as const }),
        }),
      ]),
    });
    const result = layoutC64Program({
      program: Object.freeze({ ...base, functions: Object.freeze([branch]) }),
      certificate: certificate(),
      profile,
    });

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected repaired layout");
    const fn = result.program.functions[0]!;
    expect(fn.origin).toBeGreaterThan(profile.packager.startupAddress);
    expect(fn.blocks.every(({ origin }) => origin !== undefined)).toBe(true);
    expect(fn.blocks[0]!.terminator).toEqual(
      expect.objectContaining({
        kind: "long-branch",
        cost: { bytes: 5, minCycles: 3, maxCycles: 5 },
      }),
    );
  });

  it("should resolve a sprite-block quotient only after the asset has final placement", () => {
    const base = program(new Array<number>(64).fill(1));
    const profile = selectedProfile();
    const fn = Object.freeze({
      id: "main",
      blocks: Object.freeze([
        Object.freeze({
          label: "main.entry",
          instructions: Object.freeze([
            machineInstruction(
              profile.cpu,
              "lda",
              "immediate",
              Object.freeze({
                kind: "label",
                label: "asset:sprites",
                transform: "vic-sprite-block" as const,
              }),
            ),
          ]),
          terminator: Object.freeze({ kind: "return" as const }),
        }),
      ]),
    });
    const result = layoutC64Program({
      program: Object.freeze({ ...base, functions: Object.freeze([fn]) }),
      certificate: certificate(),
      profile,
    });

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected transformed layout");
    expect(result.program.functions[0]!.blocks[0]!.instructions[0]!.operand).toEqual({
      kind: "immediate",
      value: 0x80,
    });
  });

  it("should reject loaded resident data beyond the selected profile range", () => {
    const base = program(Object.freeze([]));
    const emptyCertificate = Object.freeze({
      ...certificate(),
      homes: Object.freeze([]),
      staticBytes: Object.freeze({ ram: 0, zeroPage: 0 }),
      peakBytes: Object.freeze({ ram: 0, zeroPage: 0 }),
    });
    const oversized = Object.freeze({
      ...base,
      data: Object.freeze([
        Object.freeze({
          id: "resident",
          kind: "immutable" as const,
          alignment: 1,
          bytes: Object.freeze(new Array<number>(0xb800).fill(0)),
        }),
      ]),
    });
    expect(
      layoutC64Program({
        program: oversized,
        certificate: emptyCertificate,
        profile: selectedProfile(),
      }),
    ).toEqual({ kind: "error", reason: "resident-range", objectId: null });
  });
});
