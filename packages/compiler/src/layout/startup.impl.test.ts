import { describe, expect, it } from "vitest";
import { machineCost } from "../machine/lower-control.js";
import type { MachineFunction, MachineProgram } from "../machine/machine-types.js";
import { selectTargetProfile } from "../target/profile.js";
import { bindC64StartupState, createC64Startup, createC64StartupStateData } from "./startup.js";

function profile() {
  const selected = selectTargetProfile("c64-pal-prg-kernal-6581");
  if (selected.kind !== "complete") throw new Error("Expected C64 profile");
  return selected.profile;
}

function configuredProgram(compact: boolean): MachineProgram {
  const c64Startup = { initializerLabels: [], mainLabel: "main", displayIndependent: compact };
  const startup = createC64Startup({ ...c64Startup, profile: profile() });
  if (startup.kind !== "complete") throw new Error("Expected startup");
  return {
    functions: [],
    data: [createC64StartupStateData(c64Startup)],
    startup: startup.startup,
    c64Startup,
    requiredStorage: [],
  };
}

/** Count the structured startup itself, without substituting PRG or whole-program cost. */
function startupBytes(startup: MachineFunction): number {
  return startup.blocks.reduce(
    (total, block) =>
      total +
      block.instructions.reduce((bytes, instruction) => bytes + instruction.cost.bytes, 0) +
      (block.terminator.kind === "return" ? machineCost(profile().cpu, "rts", "implied").bytes : 0),
    0,
  );
}

describe("C64 startup binding", () => {
  it.each([false, true])(
    "should report current emitted held/transient facts without changing rebound startup, compact=%s",
    (compact) => {
      const original = configuredProgram(compact);
      const input = {
        initializerLabels: [],
        mainLabel: "main",
        displayIndependent: compact,
        profile: profile(),
      };
      const result = createC64Startup(input);
      expect(result.kind).toBe("complete");
      if (result.kind !== "complete") return;
      expect(result.stackDemand).toEqual(
        compact ? { heldBytes: 1, transientPeakBytes: 2 } : { heldBytes: 0, transientPeakBytes: 1 },
      );
      expect(result.startup).toEqual(original.startup);
      const bound = bindC64StartupState(
        original,
        [{ requestId: "borrowed", address: 3, bytes: 1, region: "zero-page" }],
        profile(),
      );
      expect(bound).not.toBeNull();
      if (bound === null) return;
      const rebound = createC64Startup({ ...bound.c64Startup!, profile: profile() });
      expect(rebound.kind).toBe("complete");
      if (rebound.kind !== "complete") return;
      expect(rebound.stackDemand).toEqual(result.stackDemand);
      expect(rebound.startup).toEqual(bound.startup);
    },
  );

  it("keeps full direct construction and uses the three-byte compact state only with proof", () => {
    const full = configuredProgram(false);
    const compact = configuredProgram(true);
    const direct = createC64Startup({
      initializerLabels: [],
      mainLabel: "main",
      profile: profile(),
    });
    expect(direct.kind).toBe("complete");
    if (direct.kind !== "complete") throw new Error("Expected default startup");
    expect(direct.startup).toEqual(full.startup);
    expect(createC64StartupStateData().bytes).toHaveLength(49);
    expect(compact.data[0]!.bytes).toHaveLength(3);
    expect(startupBytes(compact.startup)).toBe(69);
    expect(startupBytes(full.startup)).toBe(609);
  });

  it("holds the original status on the stack and copies it for the compact main entry", () => {
    const compact = createC64Startup({
      initializerLabels: [],
      mainLabel: "main",
      displayIndependent: true,
      profile: profile(),
    });
    const full = createC64Startup({
      initializerLabels: [],
      mainLabel: "main",
      profile: profile(),
    });
    if (compact.kind !== "complete" || full.kind !== "complete")
      throw new Error("Expected both startup constructors");
    const entry = compact.startup.blocks[0]!.instructions;
    const restore = compact.startup.blocks[1]!.instructions;
    expect(entry.slice(0, 3).map(({ opcode }) => opcode)).toEqual(["php", "sei", "cld"]);
    expect(restore[0]?.opcode).toBe("sei");
    expect(compact.stackDemand).toEqual({ heldBytes: 1, transientPeakBytes: 2 });
    const copy = entry.slice(-6);
    expect(copy.map(({ opcode }) => opcode)).toEqual(["tsx", "inx", "lda", "pha", "plp", "cld"]);
    expect(copy[2]).toMatchObject({
      mode: "absolute-x",
      operand: { kind: "absolute", value: 0x0100 },
    });
    const restoreCopy = restore.slice(-6);
    expect(restoreCopy.map(({ opcode }) => opcode)).toEqual([
      "tsx",
      "inx",
      "lda",
      "txs",
      "pha",
      "plp",
    ]);
    expect(restoreCopy[2]).toMatchObject({
      mode: "absolute-x",
      operand: { kind: "absolute", value: 0x0100 },
    });
    expect(compact.startup.blocks[1]!.instructions.at(-1)?.opcode).toBe("plp");
    expect(full.stackDemand).toEqual({ heldBytes: 0, transientPeakBytes: 1 });
    expect(full.startup.blocks[0]!.instructions[0]?.opcode).toBe("sta");
    expect(full.startup.blocks[1]!.instructions[0]?.opcode).toBe("lda");
  });

  it("stores status without a held byte or stack reset and charges the complete fragments", () => {
    const input = {
      initializerLabels: [],
      mainLabel: "main",
      displayIndependent: true,
      startupPolicy: "compact-stored" as const,
      profile: profile(),
    };
    const result = createC64Startup(input);
    if (result.kind !== "complete") throw new Error("Expected stored-status startup");
    expect(result.stackDemand).toEqual({ heldBytes: 0, transientPeakBytes: 1 });
    expect(createC64StartupStateData(input).bytes).toHaveLength(7);
    expect(startupBytes(result.startup)).toBe(86);
    const instructions = result.startup.blocks.flatMap((block) => block.instructions);
    const cycles = instructions.reduce((sum, instruction) => sum + instruction.cost.minCycles, 6);
    expect(cycles).toBe(135);
    expect(instructions.some(({ opcode }) => opcode === "txs" || opcode === "tsx")).toBe(false);
    expect(result.startup.blocks[0]!.instructions.slice(0, 8).map(({ opcode }) => opcode)).toEqual([
      "sta",
      "stx",
      "sty",
      "php",
      "sei",
      "pla",
      "sta",
      "cld",
    ]);
    expect(result.startup.blocks[1]!.instructions.slice(-6).map(({ opcode }) => opcode)).toEqual([
      "lda",
      "pha",
      "lda",
      "ldx",
      "ldy",
      "plp",
    ]);
    expect(createC64Startup({ ...input, displayIndependent: false }).kind).toBe("error");
  });

  it.each([true, false])("snapshots the actual unique BASIC bytes, compact=%s", (compact) => {
    const original = configuredProgram(compact);
    const source = {
      id: "global.workspace",
      kind: "bss" as const,
      alignment: 1,
      bytes: [0, 0, 0],
      zeropage: true,
      placement: { at: 0x73, align: 1, noCross: null, region: null },
    };
    const homes = [
      { requestId: "vector", address: 3, bytes: 2, region: "zero-page" as const },
      { requestId: "overlay", address: 4, bytes: 1, region: "zero-page" as const },
      { requestId: "free", address: 2, bytes: 1, region: "zero-page" as const },
      { requestId: "ram", address: 0xc000, bytes: 1, region: "ram" as const },
    ];
    const program = { ...original, data: [...original.data, source] };
    const result = bindC64StartupState(program, homes, profile());
    expect(result).not.toBeNull();
    if (result === null) throw new Error("Expected complete startup binding");
    expect(result.data[0]!.bytes).toHaveLength((compact ? 3 : 49) + 5);
    expect(startupBytes(result.startup)).toBe(startupBytes(original.startup) + 50);
    expect(result.requiredStorage).toBe(program.requiredStorage);
    expect(result.data[1]).toBe(source);
    expect(bindC64StartupState(result, homes, profile())).toEqual(result);
    for (const address of [3, 4, 0x73, 0x74, 0x75]) {
      for (const [blockIndex, opcode] of [
        [0, "lda"],
        [1, "sta"],
      ] as const) {
        expect(
          result.startup.blocks[blockIndex]!.instructions.filter(
            (instruction) =>
              instruction.opcode === opcode &&
              instruction.mode === "zero-page" &&
              instruction.operand?.kind === "absolute" &&
              instruction.operand.value === address,
          ),
        ).toHaveLength(1);
      }
    }
  });

  it("does not repair an invalid supplied state object", () => {
    const program = configuredProgram(true);
    const bad = { ...program, data: [{ ...program.data[0]!, bytes: [0, 0] }] };
    expect(bindC64StartupState(bad, [], profile())).toBeNull();
  });

  it("does not guess a source zero-page placement", () => {
    const program = configuredProgram(true);
    const unknown = {
      id: "global.workspace",
      kind: "bss" as const,
      alignment: 1,
      bytes: [0],
      zeropage: true,
    };
    expect(
      bindC64StartupState({ ...program, data: [...program.data, unknown] }, [], profile()),
    ).toBeNull();
  });
});
