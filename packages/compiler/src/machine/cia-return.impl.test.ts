import { describe, expect, it } from "vitest";
import type { PlatformOperation } from "../semantic/operations.js";
import { selectTargetProfile } from "../target/profile.js";
import { lowerC64InterruptOperation } from "./lower-c64-interrupt.js";
import { sourceSpan, VOID } from "./lowering-test-support.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;

/** Lower one already-proved vector operation; any scratch demand fails this fixture. */
function lower(profileId: string, handback: boolean, capability = "c64.system.restoreIRQ") {
  const selected = selectTargetProfile(profileId);
  if (selected.kind !== "complete") throw new Error("Expected qualified profile");
  const operation: PlatformOperation = {
    kind: "platform",
    result: null,
    capability,
    arguments: [],
    type: VOID,
    effect: "volatile-write",
    span: sourceSpan(10),
  };
  const result = lowerC64InterruptOperation(operation, selected.profile, {
    requestScratch: () => {
      throw new Error("Handback must not create function storage");
    },
    interruptBinding: () => ({
      linkRequestId: "saved-link",
      entryLabel: "handler-entry",
      matchingLowNmi: capability === "c64.system.restoreNMI",
      stockCia1Handback: handback,
    }),
  });
  if (result === null) throw new Error("Expected a recognized vector operation");
  return { operation, result };
}

describe.each(profiles)("direct CIA1 handback internals on %s", (profileId) => {
  it("should record every effect in transaction order with exactly two nonvolatile link reads", () => {
    const { operation, result } = lower(profileId, true);
    const memory = result.instructions.flatMap((instruction) => instruction.memory);
    expect(memory.map(({ order }) => order)).toEqual(
      Array.from({ length: 14 }, (_, index) => index),
    );
    expect(memory.filter(({ volatile }) => !volatile)).toEqual([
      {
        kind: "read",
        address: { kind: "storage", requestId: "saved-link", offset: 0 },
        width: 1,
        volatile: false,
        order: 7,
      },
      {
        kind: "read",
        address: { kind: "storage", requestId: "saved-link", offset: 1 },
        width: 1,
        volatile: false,
        order: 9,
      },
    ]);
    expect(
      memory
        .filter(({ volatile }) => volatile)
        .map(({ kind, address, width }) => ({ kind, address, width })),
    ).toEqual([
      { kind: "write", address: { kind: "absolute", value: 0xdc0d }, width: 1 },
      { kind: "read", address: { kind: "absolute", value: 0xdc0e }, width: 1 },
      { kind: "write", address: { kind: "absolute", value: 0xdc0e }, width: 1 },
      { kind: "write", address: { kind: "absolute", value: 0xdc0f }, width: 1 },
      { kind: "read", address: { kind: "absolute", value: 0xdc0d }, width: 1 },
      { kind: "write", address: { kind: "absolute", value: 0xdc04 }, width: 1 },
      { kind: "write", address: { kind: "absolute", value: 0xdc05 }, width: 1 },
      { kind: "write", address: { kind: "absolute", value: 0x0314 }, width: 1 },
      { kind: "write", address: { kind: "absolute", value: 0x0315 }, width: 1 },
      { kind: "write", address: { kind: "absolute", value: 0xdc0d }, width: 1 },
      { kind: "read", address: { kind: "absolute", value: 0xdc0e }, width: 1 },
      { kind: "write", address: { kind: "absolute", value: 0xdc0e }, width: 1 },
    ]);
    expect(result.instructions.every(({ source }) => source === operation.span)).toBe(true);
    expect(result.result).toBeNull();
    expect(result.data).toEqual([]);
  });

  it("should keep the existing CPU-status envelope and direct equal-contract cost", () => {
    const { result } = lower(profileId, true);
    expect(result.instructions.slice(0, 3).map(({ opcode }) => opcode)).toEqual([
      "php",
      "pha",
      "sei",
    ]);
    expect(result.instructions.slice(-2).map(({ opcode }) => opcode)).toEqual(["pla", "plp"]);
    expect(result.instructions.at(-1)?.defines.flags).toEqual(
      expect.arrayContaining(["n", "v", "d", "i", "z", "c"]),
    );
    expect(
      result.instructions.every(
        ({ defines }) => !defines.registers.includes("x") && !defines.registers.includes("y"),
      ),
    ).toBe(true);
    expect(
      result.instructions.reduce(
        (cost, instruction) => ({
          bytes: cost.bytes + instruction.cost.bytes,
          minCycles: cost.minCycles + instruction.cost.minCycles,
          maxCycles: cost.maxCycles + instruction.cost.maxCycles,
        }),
        { bytes: 0, minCycles: 0, maxCycles: 0 },
      ),
    ).toEqual({ bytes: 61, minCycles: 86, maxCycles: 86 });
    const immediateValues = result.instructions.flatMap(({ operand }) =>
      operand?.kind === "immediate" ? [operand.value] : [],
    );
    expect(immediateValues).toEqual([
      0x1f,
      0x80,
      0x08,
      profileId.includes("-pal-") ? 0x25 : 0x95,
      profileId.includes("-pal-") ? 0x40 : 0x42,
      0x81,
      0x11,
    ]);
    expect(
      result.instructions.some(({ opcode }) => opcode === "jsr" || opcode.startsWith("b")),
    ).toBe(false);
  });
});

describe("direct handback admission boundaries", () => {
  it.each(["c64.system.restoreIRQ", "c64.system.restoreNMI", "c64.system.setIRQ"])(
    "should add no CIA1 effects without proof for %s",
    (capability) => {
      const { result } = lower(profiles[0], false, capability);
      expect(
        result.instructions
          .flatMap(({ memory }) => memory)
          .some(
            ({ address }) =>
              address.kind === "absolute" && address.value >= 0xdc00 && address.value <= 0xddff,
          ),
      ).toBe(false);
    },
  );

  it.each(["c64.system.restoreNMI", "c64.system.setIRQ", "c64.system.setIRQExclusive"])(
    "should fail closed when handback proof is incorrectly attached to %s",
    (capability) => {
      expect(() => lower(profiles[0], true, capability)).toThrow(
        /proved cooperative final IRQ restore/u,
      );
    },
  );
});
