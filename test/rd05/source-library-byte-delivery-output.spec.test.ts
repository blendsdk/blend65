import { describe, expect, it } from "vitest";
import { cia2FunctionVariants } from "./cia2-output-fixture.js";
import {
  expectLibraryAccounting,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";

/** One complete leaf, with a budget derived from its ordinary accumulator operations. */
interface LeafCase {
  readonly name: string;
  readonly expression: string;
  readonly operations: number;
}

// Each byte operation can consume the preceding value directly in A.
const LEAVES: readonly LeafCase[] = [
  { name: "complement", expression: "~input", operations: 1 },
  { name: "volatile complement", expression: "~peek(INPUT)", operations: 1 },
  { name: "and", expression: "input & $7f", operations: 1 },
  { name: "or", expression: "input | $80", operations: 1 },
  { name: "xor", expression: "input ^ $a5", operations: 1 },
  { name: "complement into and", expression: "~input & $7f", operations: 2 },
  { name: "complement into or", expression: "~input | $80", operations: 2 },
  { name: "complement into xor", expression: "~input ^ $a5", operations: 2 },
  { name: "and into complement", expression: "~(input & $7f)", operations: 2 },
  { name: "or into complement", expression: "~(input | $80)", operations: 2 },
  { name: "xor into complement", expression: "~(input ^ $a5)", operations: 2 },
  { name: "and into or", expression: "(input & $7f) | $20", operations: 2 },
  { name: "or into xor", expression: "(input | $80) ^ $20", operations: 2 },
  { name: "xor into and", expression: "(input ^ $a5) & $7f", operations: 2 },
  { name: "complement and xor chain", expression: "(~input & $7f) ^ $20", operations: 3 },
  { name: "and or xor chain", expression: "((input & $7f) | $20) ^ $a5", operations: 3 },
];

/** The public parameter-home ABI permits either zero-page or absolute placement. */
const RETURNS: readonly LeafCase[] = [
  { name: "parameter complement", expression: "~value", operations: 1 },
  { name: "parameter and", expression: "value & $7f", operations: 1 },
  { name: "parameter or", expression: "value | $80", operations: 1 },
  { name: "parameter xor", expression: "value ^ $a5", operations: 1 },
  { name: "parameter chain", expression: "(~value & $7f) ^ $20", operations: 3 },
];

/** Exercise a leaf from normal source through the public build with optimization disabled. */
function storeSource(expression: string): string {
  return `module Game;
const INPUT: word = $3300;
place(at: $3300) let input: byte;
place(at: $3200) let output: byte;
export function step(): void { output = ${expression}; }
export function observed(): void { }
export function main(): void {
  while (true) { step(); observed(); }
}`;
}

/** A scalar result leaves the function in A; its caller owns the eventual global store. */
function returnSource(expression: string): string {
  return `module Game;
place(at: $3300) let input: byte;
place(at: $3200) let output: byte;
export function transform(value: byte): byte { return ${expression}; }
export function observed(): void { }
export function main(): void {
  while (true) { output = transform(input); observed(); }
}`;
}

/** Boundary-aligned official NMOS instructions admitted by the complete-leaf oracle. */
interface Instruction {
  readonly opcode: number;
  readonly operand: number | null;
  readonly cycles: number;
}

/**
 * Documented NMOS widths and fixed cycles. Staging instructions are decoded so they cannot
 * disappear from the cost merely because they belong to an intermediate source operation.
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

/** Decode every byte in the published complete leaf, never a filtered operation slice. */
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
  expect(result.at(-1)?.opcode, "The complete leaf includes its return").toBe(0x60);
  return result;
}

/**
 * LDA abs (3 bytes/4 cycles), immediate ALU (2/2 each), optional STA abs (3/4), RTS (1/6).
 * Parameter homes may improve these worst-case absolute bounds by using zero page.
 */
function expectCompleteCost(bytes: Buffer, operations: number, storesResult: boolean): void {
  const decoded = instructions(bytes);
  const byteLimit = 3 + 2 * operations + (storesResult ? 3 : 0) + 1;
  const cycleLimit = 4 + 2 * operations + (storesResult ? 4 : 0) + 6;
  expect(
    bytes.length,
    "Complete leaf bytes including all producers and return",
  ).toBeLessThanOrEqual(byteLimit);
  expect(decoded.reduce((sum, instruction) => sum + instruction.cycles, 0)).toBeLessThanOrEqual(
    cycleLimit,
  );
}

/** Values stay in A across adjacent byte operators; only the source and final destination need RAM. */
function expectNoStaging(bytes: Buffer, storesResult: boolean): void {
  const decoded = instructions(bytes);
  const memoryReads = [0xad, 0xa5, 0x05, 0x0d, 0x25, 0x2d, 0x45, 0x4d];
  expect(
    decoded.every(({ opcode }) =>
      [...memoryReads, 0xa9, 0x29, 0x09, 0x49, 0x8d, 0x60].includes(opcode),
    ),
    "Adjacent byte delivery needs no private stores, transfers, stack staging or helper calls",
  ).toBe(true);
  const reads = decoded.filter(({ opcode }) => memoryReads.includes(opcode));
  expect(reads).toHaveLength(1);
  const writes = decoded.filter(({ opcode }) => opcode === 0x8d);
  expect(writes).toHaveLength(storesResult ? 1 : 0);
  if (storesResult) {
    expect(reads[0]!.operand).toBe(0x3300);
    expect(writes[0]!.operand).toBe(0x3200);
  }
}

describe.each(sourceLibraryProfiles)("complete adjacent byte delivery on %s", (profile) => {
  it.each(LEAVES)(
    "should meet the complete expert store cost for $name",
    async ({ expression, operations }) => {
      // A fixed-byte source, each immediate operation and one source store form the entire leaf.
      await withLibraryBuild(
        storeSource(expression),
        "module Extra;",
        profile,
        async (artifacts) => {
          expectLibraryAccounting(artifacts);
          const variants = cia2FunctionVariants(artifacts, "step");
          expect(variants).toHaveLength(1);
          for (const { bytes } of variants) expectCompleteCost(bytes, operations, true);
        },
      );
    },
    180_000,
  );

  it.each(LEAVES)(
    "should deliver $name directly from its byte producer to its store",
    async ({ expression }) => {
      // No intermediate home is needed while a sole-use byte value remains adjacent to its consumer.
      await withLibraryBuild(
        storeSource(expression),
        "module Extra;",
        profile,
        async (artifacts) => {
          const variants = cia2FunctionVariants(artifacts, "step");
          expect(variants).toHaveLength(1);
          for (const { bytes } of variants) expectNoStaging(bytes, true);
        },
      );
    },
    180_000,
  );

  it.each(RETURNS)(
    "should meet the complete expert return cost for $name",
    async ({ expression, operations }) => {
      // The return itself costs no data store because the byte-result ABI uses A.
      await withLibraryBuild(
        returnSource(expression),
        "module Extra;",
        profile,
        async (artifacts) => {
          expectLibraryAccounting(artifacts);
          const variants = cia2FunctionVariants(artifacts, "transform");
          expect(variants).toHaveLength(1);
          for (const { bytes } of variants) {
            expectCompleteCost(bytes, operations, false);
            expectNoStaging(bytes, false);
          }
        },
      );
    },
    180_000,
  );
});
