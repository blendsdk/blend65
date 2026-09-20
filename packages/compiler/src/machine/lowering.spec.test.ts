import { describe, expect, it } from "vitest";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type {
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
  SemanticProgram,
  SemanticTerminator,
  StorageValue,
} from "../semantic/operations.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { selectTargetProfile } from "../target/profile.js";
import { repairMachineBranches } from "./block-layout.js";
import { lowerMachineProgram } from "./lower.js";
import { validateMachineInstruction } from "./validate.js";

const BYTE: SemanticType = Object.freeze({ kind: "scalar", name: "byte" });
const SBYTE: SemanticType = Object.freeze({ kind: "scalar", name: "sbyte" });
const WORD: SemanticType = Object.freeze({ kind: "scalar", name: "word" });
const SWORD: SemanticType = Object.freeze({ kind: "scalar", name: "sword" });
const BOOLEAN: SemanticType = Object.freeze({ kind: "scalar", name: "boolean" });
const VOID: SemanticType = Object.freeze({ kind: "scalar", name: "void" });

function span(start: number): SourceSpan {
  return Object.freeze({ sourceId: "src/lowering.blend", start, end: start + 1 });
}

function binding(start: number): BindingId {
  return Object.freeze({ sourceId: "src/lowering.blend", span: span(start) });
}

function parameter(start: number, type: SemanticType): StorageValue {
  return Object.freeze({ id: binding(start), type });
}

function block(
  id: string,
  operations: readonly SemanticOperation[],
  terminator: SemanticTerminator,
): SemanticBlock {
  return Object.freeze({ id, operations: Object.freeze(operations), terminator });
}

function wholeProgram(
  blocks: readonly SemanticBlock[],
  parameters: readonly StorageValue[],
  result: SemanticType,
): WholeProgram {
  const main = binding(1);
  const functionValue: SemanticFunction = Object.freeze({
    id: main,
    name: "main",
    parameters: Object.freeze(parameters),
    result,
    entry: blocks[0]!.id,
    blocks: Object.freeze(blocks),
    source: span(1),
  });
  const semantic: SemanticProgram = Object.freeze({
    main,
    globals: Object.freeze([]),
    functions: Object.freeze([functionValue]),
    assets: Object.freeze([]),
    initializerOrder: Object.freeze([]),
  });
  return Object.freeze({
    semantic,
    roots: Object.freeze([
      Object.freeze({ kind: "startup" as const }),
      Object.freeze({ kind: "main" as const, function: main }),
    ]),
    callGraph: Object.freeze([Object.freeze({ function: main, callees: Object.freeze([]) })]),
    effects: Object.freeze([]),
    lifetimes: Object.freeze([]),
    reachableFunctions: Object.freeze([main]),
    reachableAssets: Object.freeze([]),
  });
}

function selectedProfile() {
  const result = selectTargetProfile("c64-pal-prg-kernal-6581");
  expect(result.kind).toBe("complete");
  if (result.kind !== "complete") throw new Error("Expected the admitted target profile");
  return result.profile;
}

function lower(
  blocks: readonly SemanticBlock[],
  parameters: readonly StorageValue[],
  resultType: SemanticType,
) {
  const program = wholeProgram(blocks, parameters, resultType);
  const inventory = inventoryStorage(program);
  const profile = selectedProfile();
  const allocation = allocateStorage(inventory, buildInterference(inventory), profile.storage);
  expect(allocation.kind).toBe("complete");
  if (allocation.kind !== "complete") throw new Error("Expected provisional storage placement");
  return lowerMachineProgram({ program, placement: allocation.placement, profile });
}

function loweredBinary(type: SemanticType, operator: string) {
  const left = parameter(10, type);
  const right = parameter(20, type);
  const comparison = operator === "<" || operator === "<=" || operator === ">" || operator === ">=";
  const resultType = comparison ? BOOLEAN : type;
  return lower(
    [
      block(
        "main.entry",
        [
          Object.freeze({
            kind: "load" as const,
            result: "left",
            type,
            integer: null,
            place: Object.freeze({ root: left.id, path: Object.freeze([]) }),
            span: span(30),
          }),
          Object.freeze({
            kind: "load" as const,
            result: "right",
            type,
            integer: null,
            place: Object.freeze({ root: right.id, path: Object.freeze([]) }),
            span: span(31),
          }),
          Object.freeze({
            kind: "binary" as const,
            result: "result",
            type: resultType,
            integer: comparison
              ? null
              : Object.freeze({
                  width: type === BYTE || type === SBYTE ? (8 as const) : (16 as const),
                  signed: type === SBYTE || type === SWORD,
                  wrap: true,
                }),
            operator,
            left: "left",
            right: "right",
            span: span(32),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: "result" }),
      ),
    ],
    [left, right],
    resultType,
  );
}

function machineInstructions(result: ReturnType<typeof lowerMachineProgram>) {
  expect(result.kind).toBe("complete");
  if (result.kind !== "complete") throw new Error("Expected machine lowering to succeed");
  return result.program.functions.flatMap((functionValue) =>
    functionValue.blocks.flatMap(({ instructions }) => instructions),
  );
}

function machineOpcodes(result: ReturnType<typeof lowerMachineProgram>): readonly string[] {
  return machineInstructions(result).map(({ opcode }) => opcode);
}

function wrap(value: number, bits: 8 | 16): number {
  const modulus = 2 ** bits;
  return ((value % modulus) + modulus) % modulus;
}

function signed(value: number, bits: 8 | 16): number {
  const sign = 2 ** (bits - 1);
  const normalized = wrap(value, bits);
  return normalized >= sign ? normalized - 2 ** bits : normalized;
}

function state(registers: readonly string[] = [], flags: readonly string[] = []) {
  return Object.freeze({ registers: Object.freeze(registers), flags: Object.freeze(flags) });
}

function instruction(
  opcode: string,
  mode: string,
  operand: object | null,
  uses = state(),
  defines = state(),
) {
  return Object.freeze({
    opcode,
    mode,
    operand,
    uses,
    defines,
    memory: Object.freeze([]),
    cost: Object.freeze({ bytes: 1, minCycles: 2, maxCycles: 2 }),
    source: null,
  });
}

describe("mandatory NMOS machine lowering", () => {
  // Wrap behavior is independent from the expected carry-owning instruction shape.
  it("should lower byte and word addition and subtraction with explicit carry ownership", () => {
    expect(wrap(0xff + 1, 8)).toBe(0);
    expect(wrap(0 - 1, 8)).toBe(0xff);
    expect(wrap(0xffff + 1, 16)).toBe(0);
    expect(wrap(0 - 1, 16)).toBe(0xffff);

    const byteAdd = machineOpcodes(loweredBinary(BYTE, "+"));
    const byteSubtract = machineOpcodes(loweredBinary(BYTE, "-"));
    const wordAdd = machineOpcodes(loweredBinary(WORD, "+"));
    const wordSubtract = machineOpcodes(loweredBinary(WORD, "-"));

    expect(byteAdd.filter((opcode) => opcode === "clc")).toHaveLength(1);
    expect(byteAdd.filter((opcode) => opcode === "adc")).toHaveLength(1);
    expect(byteAdd.indexOf("clc")).toBeLessThan(byteAdd.indexOf("adc"));
    expect(byteSubtract.filter((opcode) => opcode === "sec")).toHaveLength(1);
    expect(byteSubtract.filter((opcode) => opcode === "sbc")).toHaveLength(1);
    expect(byteSubtract.indexOf("sec")).toBeLessThan(byteSubtract.indexOf("sbc"));
    expect(wordAdd.filter((opcode) => opcode === "clc")).toHaveLength(1);
    expect(wordAdd.filter((opcode) => opcode === "adc")).toHaveLength(2);
    expect(wordSubtract.filter((opcode) => opcode === "sec")).toHaveLength(1);
    expect(wordSubtract.filter((opcode) => opcode === "sbc")).toHaveLength(2);
  });

  // Signed order may normalize or split signs; any overflow use must follow its own definition.
  it("should keep signed and unsigned comparison behavior distinct at boundary values", () => {
    expect(signed(0x80, 8) < signed(0x7f, 8)).toBe(true);
    expect(0x80 < 0x7f).toBe(false);
    expect(signed(0x7f, 8) < signed(0x80, 8)).toBe(false);
    expect(0xff < 0x01).toBe(false);
    expect(signed(0x8000, 16) < signed(0x7fff, 16)).toBe(true);
    expect(0xffff < 0x0001).toBe(false);

    const signedCompare = machineInstructions(loweredBinary(SBYTE, "<"));
    const signedWordCompare = machineInstructions(loweredBinary(SWORD, "<"));
    const unsignedCompare = machineInstructions(loweredBinary(BYTE, "<"));
    const unsignedUses = unsignedCompare.flatMap(({ uses }) => uses.flags);
    const expectNoStaleOverflow = (instructions: ReturnType<typeof machineInstructions>): void => {
      let overflowDefined = false;
      for (const instructionValue of instructions) {
        if (instructionValue.uses.flags.includes("v")) expect(overflowDefined).toBe(true);
        if (instructionValue.defines.flags.includes("v")) overflowDefined = true;
      }
    };

    expect(signedCompare.some(({ opcode }) => opcode === "cmp" || opcode === "sbc")).toBe(true);
    expectNoStaleOverflow(signedCompare);
    expectNoStaleOverflow(signedWordCompare);
    expect(unsignedCompare.some(({ opcode }) => opcode === "cmp")).toBe(true);
    expect(unsignedUses).toContain("c");
    expect(unsignedUses).not.toContain("v");
  });

  // A comparison consumed only by control flow stays a branch, and the right effect stays guarded.
  it("should preserve branch-only comparison and short-circuit volatile effect order", () => {
    const left = parameter(40, BYTE);
    const right = parameter(50, BYTE);
    const result = lower(
      [
        block(
          "main.entry",
          [
            Object.freeze({
              kind: "load" as const,
              result: "left",
              type: BYTE,
              integer: null,
              place: Object.freeze({ root: left.id, path: Object.freeze([]) }),
              span: span(60),
            }),
            Object.freeze({
              kind: "load" as const,
              result: "right",
              type: BYTE,
              integer: null,
              place: Object.freeze({ root: right.id, path: Object.freeze([]) }),
              span: span(61),
            }),
            Object.freeze({
              kind: "binary" as const,
              result: "less",
              type: BOOLEAN,
              integer: null,
              operator: "<",
              left: "left",
              right: "right",
              span: span(62),
            }),
          ],
          Object.freeze({
            kind: "branch" as const,
            condition: "less",
            whenTrue: "short.right",
            whenFalse: "short.false",
          }),
        ),
        block(
          "short.right",
          [
            Object.freeze({
              kind: "platform" as const,
              result: "sample",
              capability: "c64.input.readJoystick2",
              arguments: Object.freeze([]),
              type: BYTE,
              effect: "volatile-read" as const,
              span: span(63),
            }),
          ],
          Object.freeze({ kind: "return" as const, value: null }),
        ),
        block("short.false", [], Object.freeze({ kind: "return" as const, value: null })),
      ],
      [left, right],
      VOID,
    );

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected direct branch lowering");
    const blocks = result.program.functions[0]!.blocks;
    const entry = blocks.find(({ label }) => label === "main.entry");
    const guarded = blocks.find(({ label }) => label === "short.right");
    expect(entry?.terminator.kind).toBe("branch");
    expect(JSON.stringify(entry)).not.toContain('"value":true');
    expect(JSON.stringify(entry)).not.toContain('"value":false');
    expect(guarded?.instructions.flatMap(({ memory }) => memory)).toEqual([
      expect.objectContaining({
        kind: "read",
        address: expect.objectContaining({ kind: "absolute", value: 0xdc00 }),
        width: 1,
        volatile: true,
        order: 0,
      }),
    ]);
    expect(blocks.find(({ label }) => label === "short.false")?.instructions).toHaveLength(0);
  });

  // A dynamic word access at the top of memory wraps its high byte and owns one SFA pointer pair.
  it("should lower dynamic byte and word memory access once, low-first and modulo 65536", () => {
    expect([0xffff, wrap(0xffff + 1, 16)]).toEqual([0xffff, 0x0000]);
    const address = parameter(70, WORD);
    const value = parameter(80, WORD);
    const result = lower(
      [
        block(
          "main.entry",
          [
            Object.freeze({
              kind: "load" as const,
              result: "address",
              type: WORD,
              integer: null,
              place: Object.freeze({ root: address.id, path: Object.freeze([]) }),
              span: span(90),
            }),
            Object.freeze({
              kind: "load" as const,
              result: "value",
              type: WORD,
              integer: null,
              place: Object.freeze({ root: value.id, path: Object.freeze([]) }),
              span: span(91),
            }),
            Object.freeze({
              kind: "memory-read" as const,
              result: "read",
              type: WORD,
              integer: Object.freeze({ width: 16 as const, signed: false, wrap: true }),
              address: "address",
              width: 2 as const,
              byteOrder: "low-first" as const,
              volatile: true as const,
              span: span(92),
            }),
            Object.freeze({
              kind: "memory-write" as const,
              address: "address",
              value: "value",
              width: 2 as const,
              byteOrder: "low-first" as const,
              volatile: true as const,
              span: span(93),
            }),
          ],
          Object.freeze({ kind: "return" as const, value: "read" }),
        ),
      ],
      [address, value],
      WORD,
    );

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected dynamic memory lowering");
    const effects = machineInstructions(result).flatMap(({ memory }) => memory);
    expect(effects.filter(({ kind }) => kind === "read")).toEqual([
      expect.objectContaining({ width: 1, volatile: true, order: 0 }),
      expect.objectContaining({ width: 1, volatile: true, order: 1 }),
    ]);
    expect(effects.filter(({ kind }) => kind === "write")).toEqual([
      expect.objectContaining({ width: 1, volatile: true, order: 0 }),
      expect.objectContaining({ width: 1, volatile: true, order: 1 }),
    ]);
    expect(effects.every(({ address: effectAddress }) => effectAddress.kind === "indirect-y")).toBe(
      true,
    );
    expect(result.binder.candidateRequestIds).toHaveLength(1);
    expect(result.program.requiredStorage).toEqual([
      expect.objectContaining({
        id: result.binder.candidateRequestIds[0],
        storageClass: "pointer",
        bytes: 2,
        region: "zero-page-required",
      }),
    ]);
  });

  // Named platform operations lower directly to the documented hardware touches and pure tests.
  it("should lower every M1 platform operation without dispatch or duplicate volatile access", () => {
    expect((0xfb & 0x04) === 0).toBe(true);
    expect((0xf7 & 0x08) === 0).toBe(true);
    expect((0xef & 0x10) === 0).toBe(true);
    expect(300 & 0xff).toBe(44);
    expect(0x2000 / 64).toBe(0x80);

    const constantInputs: readonly {
      readonly result: string;
      readonly type: SemanticType;
      readonly value: bigint | boolean;
    }[] = [
      { result: "index", type: BYTE, value: 3n },
      { result: "enabled", type: BOOLEAN, value: true },
      { result: "x", type: WORD, value: 300n },
      { result: "y", type: BYTE, value: 50n },
      { result: "block", type: BYTE, value: 0x80n },
      { result: "color", type: BYTE, value: 7n },
      { result: "address", type: WORD, value: 0x2000n },
    ];
    const constants: readonly SemanticOperation[] = constantInputs.map(
      ({ result, type, value }, index) =>
        Object.freeze({
          kind: "constant" as const,
          result,
          type,
          integer: null,
          value,
          span: span(100 + index),
        }),
    );
    const platform = (
      result: string | null,
      capability: string,
      args: readonly string[],
      type: SemanticType,
      effect: "pure" | "ordered-wait" | "volatile-read" | "volatile-write",
      source: number,
    ) =>
      Object.freeze({
        kind: "platform" as const,
        result,
        capability,
        arguments: Object.freeze(args),
        type,
        effect,
        span: span(source),
      });
    const operations: readonly SemanticOperation[] = [
      ...constants,
      platform(null, "c64.video.waitNextFrame", [], VOID, "ordered-wait", 120),
      platform("sample", "c64.input.readJoystick2", [], BYTE, "volatile-read", 121),
      platform("left", "c64.input.joystickLeft", ["sample"], BOOLEAN, "pure", 122),
      platform("right", "c64.input.joystickRight", ["sample"], BOOLEAN, "pure", 123),
      platform("fire", "c64.input.joystickFire", ["sample"], BOOLEAN, "pure", 124),
      platform(null, "c64.vic.setSpriteEnabled", ["index", "enabled"], VOID, "volatile-write", 125),
      platform(null, "c64.vic.setSpritePosition", ["index", "x", "y"], VOID, "volatile-write", 126),
      platform(null, "c64.vic.setSpritePointer", ["index", "block"], VOID, "volatile-write", 127),
      platform(null, "c64.vic.setSpriteColor", ["index", "color"], VOID, "volatile-write", 128),
      platform(null, "c64.vic.setBorderColor", ["color"], VOID, "volatile-write", 129),
      platform("sprite-block", "c64.vic.vicSpriteBlock", ["address"], BYTE, "pure", 130),
    ];
    const result = lower(
      [block("main.entry", operations, Object.freeze({ kind: "return" as const, value: null }))],
      [],
      VOID,
    );

    const instructions = machineInstructions(result);
    const effects = instructions.flatMap(({ memory }) => memory);
    expect(effects).toEqual([
      expect.objectContaining({
        kind: "read",
        address: expect.objectContaining({ value: 0xd011 }),
        volatile: true,
        order: 0,
      }),
      expect.objectContaining({
        kind: "read",
        address: expect.objectContaining({ value: 0xd011 }),
        volatile: true,
        order: 1,
      }),
      expect.objectContaining({
        kind: "read",
        address: expect.objectContaining({ value: 0xdc00 }),
        volatile: true,
      }),
      expect.objectContaining({
        kind: "read",
        address: expect.objectContaining({ value: 0xd015 }),
      }),
      expect.objectContaining({
        kind: "write",
        address: expect.objectContaining({ value: 0xd015 }),
      }),
      expect.objectContaining({
        kind: "write",
        address: expect.objectContaining({ value: 0xd006 }),
      }),
      expect.objectContaining({
        kind: "write",
        address: expect.objectContaining({ value: 0xd007 }),
      }),
      expect.objectContaining({
        kind: "read",
        address: expect.objectContaining({ value: 0xd010 }),
      }),
      expect.objectContaining({
        kind: "write",
        address: expect.objectContaining({ value: 0xd010 }),
      }),
      expect.objectContaining({
        kind: "write",
        address: expect.objectContaining({ value: 0x07fb }),
      }),
      expect.objectContaining({
        kind: "write",
        address: expect.objectContaining({ value: 0xd02a }),
      }),
      expect.objectContaining({
        kind: "write",
        address: expect.objectContaining({ value: 0xd020 }),
      }),
    ]);
    expect(instructions.some(({ opcode }) => opcode === "jsr")).toBe(false);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected platform lowering");
    expect(
      result.program.requiredStorage.some(({ storageClass }) => storageClass === "helper-scratch"),
    ).toBe(false);
  });

  // Legality is checked against the documented CPU grid and current flag validity.
  it("should reject illegal modes, undocumented or CMOS opcodes, and stale flags", () => {
    const cpu = selectedProfile().cpu;
    const invalid = [
      validateMachineInstruction(instruction("lda", "implied", null), cpu, []),
      validateMachineInstruction(
        instruction("lax", "zero-page", Object.freeze({ kind: "absolute", value: 0x20 })),
        cpu,
        [],
      ),
      validateMachineInstruction(
        instruction("stz", "absolute", Object.freeze({ kind: "absolute", value: 0x2000 })),
        cpu,
        [],
      ),
      validateMachineInstruction(
        instruction(
          "bcc",
          "relative",
          Object.freeze({ kind: "label", label: "target" }),
          state([], ["c"]),
        ),
        cpu,
        [],
      ),
    ];

    expect(invalid.map(({ kind }) => kind)).toEqual(["error", "error", "error", "error"]);
    for (const result of invalid) expect(result).not.toHaveProperty("instruction");
  });

  // The signed eight-bit branch range is kept exactly; the next byte needs a long form.
  it("should keep a branch at displacement 127 and repair displacement 128", () => {
    const branchFunction = (padding: number) =>
      Object.freeze({
        id: "branch-boundary",
        blocks: Object.freeze([
          Object.freeze({
            label: "entry",
            instructions: Object.freeze([]),
            terminator: Object.freeze({
              kind: "branch",
              opcode: "beq",
              target: "target",
              fallthrough: "padding",
              uses: state([], ["z"]),
              cost: Object.freeze({ bytes: 2, minCycles: 2, maxCycles: 4 }),
            }),
          }),
          Object.freeze({
            label: "padding",
            instructions: Object.freeze(
              Array.from({ length: padding }, () => instruction("nop", "implied", null)),
            ),
            terminator: Object.freeze({
              kind: "return",
              opcode: "rts",
              cost: Object.freeze({ bytes: 1, minCycles: 6, maxCycles: 6 }),
            }),
          }),
          Object.freeze({
            label: "target",
            instructions: Object.freeze([]),
            terminator: Object.freeze({
              kind: "return",
              opcode: "rts",
              cost: Object.freeze({ bytes: 1, minCycles: 6, maxCycles: 6 }),
            }),
          }),
        ]),
      });

    const boundary = repairMachineBranches(branchFunction(126), 0x2000);
    expect(boundary.kind).toBe("complete");
    if (boundary.kind !== "complete") throw new Error("Expected boundary branch to fit");
    expect(boundary.byteLength).toBe(130);
    expect(JSON.stringify(boundary.function)).toContain('"opcode":"beq"');
    expect(JSON.stringify(boundary.function)).not.toContain('"opcode":"jmp"');

    const repaired = repairMachineBranches(branchFunction(127), 0x2000);
    expect(repaired.kind).toBe("complete");
    if (repaired.kind !== "complete") throw new Error("Expected long branch repair");
    expect(repaired.byteLength).toBe(134);
    expect(JSON.stringify(repaired.function)).toContain('"opcode":"bne"');
    expect(JSON.stringify(repaired.function)).toContain('"opcode":"jmp"');
    expect(JSON.stringify(repaired.function)).toContain('"target":"target"');
  });
});
