import { beforeEach, describe, expect, it } from "vitest";
import type { MachineFunction, MachineInstruction } from "../machine/machine-types.js";
import { selectTargetProfile } from "../target/profile.js";
import { C64_STARTUP_STATE_ID, createC64Startup, createC64StartupStateData } from "./startup.js";

/** Every cooperative clock/SID combination must retain the same full-capture contract. */
const cases = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
].flatMap((profileId) =>
  [true, false].flatMap((restoreRequired) =>
    ["call", "inline"].map((initializer) => ({ profileId, restoreRequired, initializer })),
  ),
);

describe.each(cases)(
  "captured cooperative mapping: $profileId, restore=$restoreRequired, initializer=$initializer",
  ({ profileId, restoreRequired, initializer }) => {
    let startup: MachineFunction;
    let entry: readonly MachineInstruction[];

    beforeEach(() => {
      const selected = selectTargetProfile(profileId);
      if (selected.kind !== "complete")
        throw new Error(`Required cooperative profile: ${profileId}`);
      // Deliberate index-register clobbers are legal once the mapping has consumed both holds.
      const inline = (
        [
          ["ldx", "x", 0x5a],
          ["ldy", "y", 0xa5],
        ] as const
      ).map<MachineInstruction>(([opcode, register, value]) => ({
        opcode,
        mode: "immediate",
        operand: { kind: "immediate", value },
        uses: { registers: [], flags: [] },
        defines: { registers: [register], flags: ["n", "z"] },
        memory: [],
        cost: { bytes: 2, minCycles: 2, maxCycles: 2 },
        source: null,
      }));
      const result = createC64Startup({
        profile: selected.profile,
        initializerLabels: [],
        mainLabel: "fixture.main",
        startupPolicy: "full",
        borrowedZeroPage: [3, 4, 5],
        restoreRequired,
        initializers:
          initializer === "call"
            ? [{ kind: "call", label: "fixture.initialize" }]
            : [{ kind: "inline", instructions: inline }],
      });
      if (result.kind !== "complete")
        throw new Error(`Full startup was rejected: ${result.reason}`);
      startup = result.startup;
      const block = startup.blocks.find((candidate) => candidate.label === "startup.entry");
      if (!block) throw new Error("Full startup must publish its entry block");
      entry = block.instructions;
    });

    it("reads each processor register once and stores the same captured readback in its existing home", () => {
      const processorReads = entry.flatMap((instruction) =>
        instruction.memory.filter(
          (effect) =>
            effect.kind === "read" &&
            effect.address.kind === "absolute" &&
            effect.address.value <= 1,
        ),
      );
      expect(processorReads.map(({ address }) => address)).toEqual([
        { kind: "absolute", value: 0 },
        { kind: "absolute", value: 1 },
      ]);
      for (const [address, offset, load, store] of [
        [0, 5, "ldx", "stx"],
        [1, 6, "ldy", "sty"],
        [0xdd02, 7, "lda", "sta"],
        [0xd018, 8, "lda", "sta"],
        [0xd015, 9, "lda", "sta"],
        [3, 49, "lda", "sta"],
        [4, 50, "lda", "sta"],
        [5, 51, "lda", "sta"],
      ] as const) {
        const reads = entry.filter((instruction) =>
          instruction.memory.some(
            (effect) =>
              effect.kind === "read" &&
              effect.address.kind === "absolute" &&
              effect.address.value === address,
          ),
        );
        expect(reads).toHaveLength(1);
        const index = entry.indexOf(reads[0]!);
        expect(reads[0]).toMatchObject({
          opcode: load,
          operand: { kind: "absolute", value: address },
        });
        expect(entry[index + 1]).toMatchObject({
          opcode: store,
          operand: { kind: "label", label: C64_STARTUP_STATE_ID, offset },
          memory: [
            {
              kind: "write",
              address: { kind: "symbolic", label: C64_STARTUP_STATE_ID, offset },
              width: 1,
              order: 0,
            },
          ],
        });
        if (address === 0 || address === 1 || address >= 0xd000) {
          expect(reads[0]?.memory).toMatchObject([
            { kind: "read", width: 1, volatile: true, order: 0 },
          ]);
        }
      }
      const deviceReads = entry.flatMap((instruction) =>
        instruction.memory.filter(
          (effect) =>
            effect.kind === "read" &&
            effect.address.kind === "absolute" &&
            [0, 1, 0xdd02, 0xd018, 0xd015].includes(effect.address.value),
        ),
      );
      expect(deviceReads.map((effect) => effect.address)).toEqual(
        [0, 1, 0xd018, 0xd015, 0xdd02].map((value) => ({ kind: "absolute", value })),
      );
    });

    it("retains X/Y through the call-free capture window and uses the exact expert mapping core", () => {
      const directionCapture = entry.findIndex((instruction) =>
        instruction.memory.some(
          (effect) =>
            effect.kind === "read" &&
            effect.address.kind === "absolute" &&
            effect.address.value === 0,
        ),
      );
      const portCapture = entry.findIndex((instruction) =>
        instruction.memory.some(
          (effect) =>
            effect.kind === "read" &&
            effect.address.kind === "absolute" &&
            effect.address.value === 1,
        ),
      );
      const writes = entry.flatMap((instruction, index) =>
        instruction.memory
          .filter(
            (effect) =>
              effect.kind === "write" &&
              effect.address.kind === "absolute" &&
              effect.address.value <= 1,
          )
          .map((effect) => ({ index, effect })),
      );
      expect(writes.map(({ effect }) => effect)).toEqual([
        {
          kind: "write",
          address: { kind: "absolute", value: 1 },
          width: 1,
          volatile: true,
          order: 0,
        },
        {
          kind: "write",
          address: { kind: "absolute", value: 0 },
          width: 1,
          volatile: true,
          order: 0,
        },
      ]);
      expect(directionCapture).toBeGreaterThanOrEqual(0);
      expect(portCapture).toBeGreaterThan(directionCapture);
      const portWrite = writes[0]?.index;
      const directionWrite = writes[1]?.index;
      if (portWrite === undefined || directionWrite === undefined)
        throw new Error("Missing ordered mapping stores");
      expect(portCapture + 1).toBeLessThan(portWrite - 3);
      const core = entry.slice(portWrite - 3, directionWrite + 1);
      expect(core.map(({ opcode, operand }) => ({ opcode, operand }))).toEqual([
        { opcode: "tya", operand: null },
        { opcode: "and", operand: { kind: "immediate", value: 0xf8 } },
        { opcode: "ora", operand: { kind: "immediate", value: 6 } },
        { opcode: "sta", operand: { kind: "absolute", value: 1 } },
        { opcode: "txa", operand: null },
        { opcode: "ora", operand: { kind: "immediate", value: 7 } },
        { opcode: "sta", operand: { kind: "absolute", value: 0 } },
      ]);
      expect(core.map(({ cost }) => [cost.bytes, cost.minCycles, cost.maxCycles])).toEqual([
        [1, 2, 2],
        [2, 2, 2],
        [2, 2, 2],
        [2, 3, 3],
        [1, 2, 2],
        [2, 2, 2],
        [2, 3, 3],
      ]);
      expect(core.reduce((sum, instruction) => sum + instruction.cost.bytes, 0)).toBe(12);
      expect(core.reduce((sum, instruction) => sum + instruction.cost.minCycles, 0)).toBe(16);
      const captureCore = [
        ...entry.slice(directionCapture, directionCapture + 2),
        ...entry.slice(portCapture, portCapture + 2),
      ];
      expect(captureCore.map(({ cost }) => [cost.bytes, cost.minCycles, cost.maxCycles])).toEqual([
        [2, 3, 3],
        [3, 4, 4],
        [2, 3, 3],
        [3, 4, 4],
      ]);
      expect(captureCore.reduce((sum, instruction) => sum + instruction.cost.bytes, 0)).toBe(10);
      expect(captureCore.reduce((sum, instruction) => sum + instruction.cost.minCycles, 0)).toBe(
        14,
      );
      expect(entry[directionCapture]?.defines.registers).toEqual(["x"]);
      expect(entry[portCapture]?.defines.registers).toEqual(["y"]);
      for (const [index, instruction] of entry.entries()) {
        if (index <= directionCapture || index > directionWrite) continue;
        expect(instruction.opcode).not.toBe("jsr");
        expect(instruction.opcode).not.toBe("pha");
        expect(instruction.defines.registers).not.toContain("x");
        if (index !== portCapture) expect(instruction.defines.registers).not.toContain("y");
      }
      expect(core[0]?.uses.registers).toContain("y");
      expect(core[4]?.uses.registers).toContain("x");
      expect(core[0]?.defines.registers).toEqual(["a"]);
      expect(core[4]?.defines.registers).toEqual(["a"]);
    });

    it("keeps caller saves, the full snapshot, initializer boundaries and cooperative status ownership", () => {
      const state = createC64StartupStateData(
        { startupPolicy: "full", borrowedZeroPage: [3, 4, 5] },
        "cooperative",
      );
      expect(C64_STARTUP_STATE_ID).toBe("platform.startup-state");
      expect(state.id).toBe(C64_STARTUP_STATE_ID);
      expect(state.bytes).toHaveLength(52);
      expect(
        createC64StartupStateData({ startupPolicy: "full" }, "cooperative").bytes,
      ).toHaveLength(49);
      const captureIndex = entry.findIndex((instruction) =>
        instruction.memory.some(
          (effect) =>
            effect.kind === "read" &&
            effect.address.kind === "absolute" &&
            effect.address.value === 0,
        ),
      );
      expect(captureIndex).toBeGreaterThan(0);
      const savedOffsets = entry
        .slice(0, captureIndex)
        .flatMap((instruction) =>
          instruction.memory
            .filter(
              (effect) =>
                effect.kind === "write" &&
                effect.address.kind === "symbolic" &&
                effect.address.label === C64_STARTUP_STATE_ID,
            )
            .map((effect) =>
              effect.address.kind === "symbolic" ? (effect.address.offset ?? 0) : -1,
            ),
        );
      for (const offset of [0, 1, 2, 3, 4]) expect(savedOffsets).toContain(offset);
      expect(entry.some((instruction) => instruction.operand?.kind === "storage")).toBe(false);
      expect(entry.map(({ opcode }) => opcode)).toContain("cld");
      expect(entry.map(({ opcode }) => opcode)).not.toContain("sei");
      expect(entry.map(({ opcode }) => opcode)).not.toContain("cli");
      const mappingEnd = entry.findIndex((instruction) =>
        instruction.memory.some(
          (effect) =>
            effect.kind === "write" &&
            effect.address.kind === "absolute" &&
            effect.address.value === 0,
        ),
      );
      const initializerIndex = entry.findIndex((instruction) =>
        initializer === "call"
          ? instruction.opcode === "jsr" &&
            instruction.operand?.kind === "label" &&
            instruction.operand.label === "fixture.initialize"
          : instruction.opcode === "ldx" &&
            instruction.operand?.kind === "immediate" &&
            instruction.operand.value === 0x5a,
      );
      expect(mappingEnd).toBeGreaterThan(captureIndex);
      expect(initializerIndex).toBeGreaterThan(mappingEnd);
      if (restoreRequired) {
        expect(startup.blocks.some((block) => block.label === "startup.restore")).toBe(true);
        const restoration = startup.blocks
          .filter((block) => block.label !== "startup.entry")
          .flatMap((block) => block.instructions);
        const restoredOffsets = restoration.flatMap((instruction) =>
          instruction.memory
            .filter(
              (effect) =>
                effect.kind === "read" &&
                effect.address.kind === "symbolic" &&
                effect.address.label === C64_STARTUP_STATE_ID,
            )
            .map((effect) =>
              effect.address.kind === "symbolic" ? (effect.address.offset ?? 0) : -1,
            ),
        );
        for (const offset of [0, 1, 2, 3, 4, 5, 6]) expect(restoredOffsets).toContain(offset);
        const restoredProcessor = restoration.flatMap((instruction) =>
          instruction.memory.filter(
            (effect) =>
              effect.kind === "write" &&
              effect.address.kind === "absolute" &&
              effect.address.value <= 1,
          ),
        );
        expect(restoredProcessor.map((effect) => effect.address)).toEqual([
          { kind: "absolute", value: 1 },
          { kind: "absolute", value: 0 },
        ]);
      }
    });
  },
);
