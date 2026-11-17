import { describe, expect, it } from "vitest";
import type { MachineProgram } from "../machine/machine-types.js";
import { selectTargetProfile } from "../target/profile.js";
import {
  bindC64StartupState,
  C64_STARTUP_STATE_ID,
  createC64Startup,
  createC64StartupStateData,
} from "./startup.js";

/** Fail fixture setup rather than accidentally testing a different ownership profile. */
function profile(id = "c64-pal-prg-kernal-6581") {
  const selected = selectTargetProfile(id);
  if (selected.kind !== "complete") throw new Error(`Missing startup fixture profile: ${id}`);
  return selected.profile;
}

describe("captured processor-port constructor isolation", () => {
  it.each([true, false])(
    "should retain full readbacks after final borrowed-state binding, restore=%s",
    (restoreRequired) => {
      const selected = profile();
      const configuration = {
        initializerLabels: [],
        mainLabel: "main",
        startupPolicy: "full" as const,
        restoreRequired,
      };
      const initial = createC64Startup({ ...configuration, profile: selected });
      if (initial.kind !== "complete") throw new Error(initial.reason);
      const program: MachineProgram = {
        functions: [],
        startup: initial.startup,
        c64Startup: configuration,
        data: [
          createC64StartupStateData(configuration),
          {
            id: "global.borrowed",
            kind: "bss",
            alignment: 1,
            bytes: [0, 0],
            zeropage: true,
            placement: { at: 0x73, align: 1, noCross: null, region: null },
          },
        ],
        requiredStorage: [],
      };
      const homes = [
        { requestId: "frame.borrowed", address: 3, bytes: 3, region: "zero-page" as const },
      ];
      const bound = bindC64StartupState(program, homes, selected);
      if (bound === null || bound.c64Startup === undefined)
        throw new Error("Expected final borrowed-state binding");
      const reconstructed = createC64Startup({ ...bound.c64Startup, profile: selected });
      if (reconstructed.kind !== "complete") throw new Error(reconstructed.reason);
      expect(bound.startup).toEqual(reconstructed.startup);
      expect(bound.requiredStorage).toBe(program.requiredStorage);
      expect(bound.data[1]).toBe(program.data[1]);
      expect(bound.data.find(({ id }) => id === C64_STARTUP_STATE_ID)?.bytes).toHaveLength(54);
      expect(bindC64StartupState(bound, homes, selected)).toEqual(bound);

      const entry = bound.startup.blocks[0]!.instructions;
      const direction = entry.findIndex(
        ({ opcode, operand }) =>
          opcode === "ldx" && operand?.kind === "absolute" && operand.value === 0,
      );
      const port = entry.findIndex(
        ({ opcode, operand }) =>
          opcode === "ldy" && operand?.kind === "absolute" && operand.value === 1,
      );
      const consume = entry.findIndex(({ opcode }) => opcode === "tya");
      expect(direction).toBeGreaterThanOrEqual(0);
      expect(port).toBeGreaterThan(direction);
      expect(consume).toBeGreaterThan(port);
      const window = entry.slice(port + 1, consume);
      // Rebinding adds real BASIC-byte snapshots, but they cannot invalidate the held readbacks.
      expect(window.flatMap(({ defines }) => defines.registers)).not.toContain("x");
      expect(window.flatMap(({ defines }) => defines.registers)).not.toContain("y");
      for (const [index, address] of [3, 4, 5, 0x73, 0x74].entries()) {
        const capture = window.findIndex(
          ({ opcode, operand }) =>
            opcode === "lda" && operand?.kind === "absolute" && operand.value === address,
        );
        expect(capture).toBeGreaterThanOrEqual(0);
        expect(window[capture + 1]).toMatchObject({
          opcode: "sta",
          operand: { kind: "label", label: C64_STARTUP_STATE_ID, offset: 49 + index },
        });
      }
      expect(reconstructed.stackDemand).toEqual(initial.stackDemand);
      expect(bound.startup.blocks.some(({ label }) => label === "startup.restore")).toBe(
        restoreRequired,
      );
    },
  );

  it.each([
    { startupPolicy: "compact-unrolled", preserveY: false },
    { startupPolicy: "compact-looped", preserveY: false },
    { startupPolicy: "compact-stored", preserveY: false },
    { startupPolicy: "compact-stored", preserveY: true },
  ] as const)(
    "should keep A-based port capture in $startupPolicy, preserveY=$preserveY",
    ({ startupPolicy, preserveY }) => {
      const result = createC64Startup({
        profile: profile(),
        initializerLabels: [],
        mainLabel: "main",
        displayIndependent: true,
        startupPolicy,
        preserveY,
        borrowedZeroPage: [3, 4, 5],
      });
      if (result.kind !== "complete") throw new Error(result.reason);
      const instructions = result.startup.blocks.flatMap((block) => block.instructions);
      for (const [address, opcode] of [
        [0, "ldx"],
        [1, "lda"],
      ] as const) {
        const captures = instructions.filter((instruction) =>
          instruction.memory.some(
            (effect) =>
              effect.kind === "read" &&
              effect.address.kind === "absolute" &&
              effect.address.value === address,
          ),
        );
        expect(captures).toHaveLength(1);
        expect(captures[0]?.opcode).toBe(opcode);
      }
      expect(instructions.some(({ opcode }) => opcode === "tya")).toBe(false);
    },
  );

  it("should keep the independent takeover capture, vector and mapping path", () => {
    const selected = profile("c64-pal-prg-takeover-6581");
    const result = createC64Startup({
      profile: selected,
      initializerLabels: [],
      mainLabel: "main",
      borrowedZeroPage: [3, 4, 5],
    });
    if (result.kind !== "complete") throw new Error(result.reason);
    const entry = result.startup.blocks[0]!.instructions;
    const transfer = entry.findIndex(({ opcode }) => opcode === "tya");
    expect(transfer).toBeGreaterThan(0);
    expect(entry[transfer + 2]).toMatchObject({
      opcode: "ora",
      operand: { kind: "immediate", value: 5 },
    });
    const priorWrites = entry.slice(0, transfer).flatMap((instruction) => instruction.memory);
    for (const address of [0xfffa, 0xfffb, 0xfffe, 0xffff])
      expect(priorWrites).toContainEqual({
        kind: "write",
        address: { kind: "absolute", value: address },
        width: 1,
        volatile: true,
        order: 0,
      });
    expect(result.entries?.map(({ id }) => id)).toEqual([
      "startup.rawIrqDefault.fn",
      "startup.rawNmiDefault.fn",
    ]);
    expect(createC64StartupStateData(undefined, "takeover").bytes).toHaveLength(8);
  });
});
