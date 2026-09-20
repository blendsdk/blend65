import { describe, expect, it } from "vitest";
import type { StorageClosureCertificate } from "../storage/storage-types.js";
import { selectTargetProfile } from "../target/profile.js";
import { layoutC64Program } from "./c64-layout.js";
import { createC64Startup } from "./startup.js";

const BASIC_STUB = Object.freeze([
  0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00,
]);

function selectedProfile() {
  const result = selectTargetProfile("c64-pal-prg-kernal-6581");
  expect(result.kind).toBe("complete");
  if (result.kind !== "complete") throw new Error("Expected the admitted target profile");
  return result.profile;
}

function state(registers: readonly string[] = [], flags: readonly string[] = []) {
  return Object.freeze({ registers: Object.freeze(registers), flags: Object.freeze(flags) });
}

function instruction(opcode: string, bytes: number) {
  return Object.freeze({
    opcode,
    mode: "implied",
    operand: null,
    uses: state(),
    defines: state(),
    memory: Object.freeze([]),
    cost: Object.freeze({ bytes, minCycles: 2, maxCycles: 2 }),
    source: null,
  });
}

function machineFunction(id: string, opcodes: readonly string[]) {
  return Object.freeze({
    id,
    blocks: Object.freeze([
      Object.freeze({
        label: `${id}.entry`,
        instructions: Object.freeze(opcodes.map((opcode) => instruction(opcode, 1))),
        terminator: Object.freeze({
          kind: "return",
          opcode: "rts",
          cost: Object.freeze({ bytes: 1, minCycles: 6, maxCycles: 6 }),
        }),
      }),
    ]),
  });
}

function certificate(): StorageClosureCertificate {
  return Object.freeze({
    inventoryHash: "inventory-hash",
    graphHash: "graph-hash",
    profileId: "c64-pal-prg-kernal-6581",
    homes: Object.freeze([
      Object.freeze({ requestId: "sfa:main:temporary", address: 0x0334, bytes: 2, region: "ram" }),
    ]),
    interference: Object.freeze([]),
    helperCalls: Object.freeze([]),
    staticBytes: Object.freeze({ ram: 2, zeroPage: 0 }),
    peakBytes: Object.freeze({ ram: 2, zeroPage: 0 }),
    hardwareStackPeak: 20,
    closed: true,
  });
}

describe("C64 startup", () => {
  // The BASIC line is exact, initializers retain module order, and main is entered by fallthrough.
  it("should create the exact auto-start stub and cooperative returning startup", () => {
    const result = createC64Startup({
      initializerLabels: Object.freeze(["init.alpha", "init.beta"]),
      mainLabel: "main",
      profile: selectedProfile(),
    });

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected C64 startup construction");
    expect(result.stub).toEqual({ origin: 0x0801, bytes: BASIC_STUB });
    expect(result.startup.origin).toBe(0x080d);

    const instructions = result.startup.blocks.flatMap(({ instructions }) => instructions);
    const initializerCalls = instructions.filter(({ opcode }) => opcode === "jsr");
    expect(initializerCalls.map(({ operand }) => operand)).toEqual([
      { kind: "label", label: "init.alpha" },
      { kind: "label", label: "init.beta" },
    ]);
    expect(initializerCalls.some(({ operand }) => operand.label === "main")).toBe(false);
    expect(
      result.startup.blocks.some(
        ({ terminator }) => terminator.kind === "fallthrough" && terminator.target === "main",
      ),
    ).toBe(true);

    const opcodes = instructions.map(({ opcode }) => opcode);
    expect(opcodes).toContain("php");
    expect(opcodes).toContain("cld");
    expect(opcodes).toContain("plp");
    expect(JSON.stringify(result.startup.blocks)).toContain('"opcode":"rts"');
    expect(opcodes).not.toContain("sei");
    expect(opcodes).not.toContain("cli");

    const deviceEffects = instructions.flatMap(({ memory }) => memory);
    for (const address of [0x0000, 0x0001, 0xdd00, 0xd018, 0xd015]) {
      expect(deviceEffects).toContainEqual(
        expect.objectContaining({
          kind: "read",
          address: expect.objectContaining({ kind: "absolute", value: address }),
          volatile: true,
        }),
      );
      expect(deviceEffects).toContainEqual(
        expect.objectContaining({
          kind: "write",
          address: expect.objectContaining({ kind: "absolute", value: address }),
          volatile: true,
        }),
      );
    }
  });
});

describe("C64 platform layout", () => {
  // Globals and resident assets have one platform-owned interval and never become SFA homes.
  it("should place code, state, SFA and one aligned VIC-visible asset deterministically", () => {
    const spriteBytes = Object.freeze(
      Array.from({ length: 512 }, (_, index) => ((index % 64) + Math.floor(index / 64)) & 0xff),
    );
    const startupResult = createC64Startup({
      initializerLabels: Object.freeze([]),
      mainLabel: "main",
      profile: selectedProfile(),
    });
    expect(startupResult.kind).toBe("complete");
    if (startupResult.kind !== "complete") throw new Error("Expected startup construction");

    const program = Object.freeze({
      functions: Object.freeze([machineFunction("main", ["lda", "sta"])]),
      data: Object.freeze([
        Object.freeze({
          id: "global:score",
          kind: "global",
          alignment: 1,
          bytes: Object.freeze([0, 0]),
        }),
        Object.freeze({
          id: "global:enemy-state",
          kind: "bss",
          alignment: 1,
          bytes: Object.freeze(new Array<number>(16).fill(0)),
        }),
        Object.freeze({
          id: "asset:sprites",
          kind: "asset",
          assetId: "sprites",
          alignment: 64,
          bytes: spriteBytes,
        }),
      ]),
      startup: startupResult.startup,
      requiredStorage: Object.freeze([]),
    });
    const input = Object.freeze({
      program,
      certificate: certificate(),
      profile: selectedProfile(),
    });

    const first = layoutC64Program(input);
    const second = layoutC64Program(input);
    expect(first).toEqual(second);
    expect(first.kind).toBe("complete");
    if (first.kind !== "complete") throw new Error("Expected conflict-free C64 layout");

    const interval = (id: string) => {
      const found = first.intervals.filter((candidate) => candidate.id === id);
      expect(found).toHaveLength(1);
      return found[0]!;
    };
    const score = interval("global:score");
    const enemyState = interval("global:enemy-state");
    const sfa = interval("sfa:main:temporary");
    const sprites = interval("asset:sprites");

    expect(score.kind).toBe("global");
    expect(enemyState.kind).toBe("bss");
    expect(sfa.kind).toBe("sfa");
    expect(score.id).not.toBe(sfa.id);
    expect(enemyState.id).not.toBe(sfa.id);
    expect(sprites.id).not.toBe(sfa.id);
    expect(sprites.start).toBe(0x2000);
    expect(sprites.end).toBe(0x21ff);
    expect(sprites.start % 64).toBe(0);
    expect(sprites.start).toBeGreaterThan(0x07ff);
    expect(sprites.end).toBeLessThan(0x4000);
    expect(sprites.bytes).toEqual(spriteBytes);
    expect(first.spriteBlocks).toEqual([0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87]);

    const ordered = [...first.intervals].sort((left, right) => left.start - right.start);
    for (let index = 1; index < ordered.length; index += 1) {
      expect(ordered[index]!.start).toBeGreaterThan(ordered[index - 1]!.end);
    }

    const loaded = first.intervals.filter(({ bytes }) => bytes !== null);
    const loadedInOrder = [...loaded].sort((left, right) => left.start - right.start);
    expect(first.loadRange).toEqual({ start: 0x0801, end: 0x21ff });
    expect(loadedInOrder[0]!.start).toBe(first.loadRange.start);
    expect(loadedInOrder.at(-1)!.end).toBe(first.loadRange.end);
    for (let index = 1; index < loadedInOrder.length; index += 1) {
      expect(loadedInOrder[index]!.start).toBe(loadedInOrder[index - 1]!.end + 1);
    }
    const fills = first.intervals.filter(({ kind }) => kind === "fill");
    expect(fills.length).toBeGreaterThan(0);
    expect(fills.every(({ bytes }) => bytes.every((byte) => byte === 0))).toBe(true);
  });
});
