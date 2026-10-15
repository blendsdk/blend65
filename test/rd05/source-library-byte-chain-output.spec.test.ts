import { describe, expect, it } from "vitest";
import { cia2FunctionVariants } from "./cia2-output-fixture.js";
import {
  expectLibraryAccounting,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";

/** Eight-bit identities are derived before any emitted output is inspected. */
const MASKS = [
  { name: "seven-bit mask", mask: "$7f", xor: "$20", combined: 0x5f },
  { name: "six-bit mask", mask: "$3f", xor: "$12", combined: 0x2d },
] as const;

/** Both ordinary storage and volatile peek yield disposable adjacent byte operands. */
const PRODUCERS = [
  { name: "ordinary byte load", expression: "input" },
  { name: "volatile byte read", expression: "peek(INPUT)" },
] as const;

/** Keep the complete fixed-global leaf reachable through ordinary exported source. */
function storeSource(producer: string, mask: string, xor: string): string {
  return `module Game;
const INPUT: word = $3300;
place(at: $3300) let input: byte;
place(at: $3200) let output: byte;
export function step(): void { output = (~${producer} & ${mask}) ^ ${xor}; }
export function observed(): void { }
export function main(): void { while (true) { step(); observed(); } }`;
}

/** The caller supplies a byte parameter home; the scalar byte result uses A. */
function returnSource(mask: string, xor: string): string {
  return `module Game;
place(at: $3300) let input: byte;
place(at: $3200) let output: byte;
export function transform(value: byte): byte { return (~value & ${mask}) ^ ${xor}; }
export function observed(): void { }
export function main(): void { while (true) { output = transform(input); observed(); } }`;
}

/** One complete boundary-aligned official NMOS instruction and its fixed cost. */
interface Instruction {
  readonly opcode: number;
  readonly operand: number | null;
  readonly cycles: number;
}

/**
 * Decode staging as well as accumulator operations, so producer or result traffic cannot escape
 * the complete-leaf budget. Indexed/page-variable forms are unnecessary for these fixed homes.
 */
const NMOS: Readonly<Record<number, readonly [number, number]>> = {
  0x05: [2, 3],
  0x08: [1, 3],
  0x09: [2, 2],
  0x0d: [3, 4],
  0x20: [3, 6],
  0x25: [2, 3],
  0x28: [1, 4],
  0x29: [2, 2],
  0x2d: [3, 4],
  0x45: [2, 3],
  0x48: [1, 3],
  0x49: [2, 2],
  0x4d: [3, 4],
  0x60: [1, 6],
  0x68: [1, 4],
  0x85: [2, 3],
  0x86: [2, 3],
  0x8a: [1, 2],
  0x8c: [3, 4],
  0x8d: [3, 4],
  0x8e: [3, 4],
  0x98: [1, 2],
  0xa2: [2, 2],
  0xa5: [2, 3],
  0xa6: [2, 3],
  0xa8: [1, 2],
  0xa9: [2, 2],
  0xaa: [1, 2],
  0xac: [3, 4],
  0xad: [3, 4],
  0xae: [3, 4],
  0xea: [1, 2],
};

/** Read every instruction through the complete leaf return, with no filtered source slices. */
function instructions(bytes: Buffer): Instruction[] {
  const result: Instruction[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const shape = NMOS[opcode];
    if (!shape || offset + shape[0] > bytes.length)
      throw new Error(`Unaccounted complete-leaf instruction $${opcode.toString(16)} at ${offset}`);
    const operand =
      shape[0] === 1 ? null : shape[0] === 2 ? bytes[offset + 1]! : bytes.readUInt16LE(offset + 1);
    result.push({ opcode, operand, cycles: shape[1] });
    offset += shape[0];
  }
  expect(result.at(-1)?.opcode, "The return instruction belongs to the complete cost").toBe(0x60);
  return result;
}

/**
 * (~x & M) ^ K = (x & M) ^ (M ^ K), bit by bit, for all eight-bit x.
 * LDA abs (3/4), AND immediate (2/2), EOR immediate (2/2), STA abs (3/4), RTS (1/6)
 * costs 11 bytes/18 cycles. Omitting the final store yields an 8-byte/14-cycle scalar return.
 * A zero-page parameter home may improve the return bound.
 */
function expectCompleteLeaf(bytes: Buffer, stores: boolean): void {
  expect(
    bytes.length,
    "Complement and masked xor need only two accumulator operations",
  ).toBeLessThanOrEqual(stores ? 11 : 8);
  const decoded = instructions(bytes);
  expect(decoded.reduce((sum, instruction) => sum + instruction.cycles, 0)).toBeLessThanOrEqual(
    stores ? 18 : 14,
  );
  const memoryReads = [0xad, 0xa5, 0x05, 0x0d, 0x25, 0x2d, 0x45, 0x4d];
  expect(
    decoded.every(({ opcode }) =>
      [...memoryReads, 0xa9, 0x29, 0x09, 0x49, 0x8d, 0x60].includes(opcode),
    ),
    "An adjacent disposable result needs no private store, transfer, stack staging or helper",
  ).toBe(true);
  const reads = decoded.filter(({ opcode }) => memoryReads.includes(opcode));
  const writes = decoded.filter(({ opcode }) => opcode === 0x8d);
  expect(reads).toHaveLength(1);
  expect(writes).toHaveLength(stores ? 1 : 0);
  if (stores) {
    expect(reads[0]!.operand).toBe(0x3300);
    expect(writes[0]!.operand).toBe(0x3200);
  }
}

describe.each(sourceLibraryProfiles)("complete disposable byte chains on %s", (profile) => {
  describe.each(PRODUCERS)("$name", ({ expression }) => {
    it.each(MASKS)(
      "should meet the complete two-operation fixed-store cost for $name",
      async ({ mask, xor, combined }) => {
        // This identity changes no source read or final write, and requires no wider arithmetic.
        expect(Number.parseInt(mask.slice(1), 16) ^ Number.parseInt(xor.slice(1), 16)).toBe(
          combined,
        );
        await withLibraryBuild(
          storeSource(expression, mask, xor),
          "module Extra;",
          profile,
          async (artifacts) => {
            expectLibraryAccounting(artifacts);
            const variants = cia2FunctionVariants(artifacts, "step");
            expect(variants).toHaveLength(1);
            for (const { bytes } of variants) expectCompleteLeaf(bytes, true);
          },
        );
      },
      180_000,
    );
  });

  it.each(MASKS)(
    "should meet the complete two-operation parameter-return cost for $name",
    async ({ mask, xor }) => {
      // Only the scalar callee is charged: its parameter load, two operations and RTS are complete.
      await withLibraryBuild(
        returnSource(mask, xor),
        "module Extra;",
        profile,
        async (artifacts) => {
          expectLibraryAccounting(artifacts);
          const variants = cia2FunctionVariants(artifacts, "transform");
          expect(variants).toHaveLength(1);
          for (const { bytes } of variants) expectCompleteLeaf(bytes, false);
        },
      );
    },
    180_000,
  );
});
