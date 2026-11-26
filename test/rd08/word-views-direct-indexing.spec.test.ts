/**
 * Bounded word indices address ordinary byte arrays directly without narrowing
 * their source storage. Reusing the index byte as the value requires identical
 * storage; wider and unchecked indices retain their full address contribution.
 */
import { describe, expect, it } from "vitest";
import { buildProfileSource } from "../rd05/profile-fixture.js";
import {
  clobbersAccumulator,
  cost,
  decodeLine,
  globalAddress,
  readMnemonics,
} from "./emitted-routine-support.js";
import type { Instruction } from "./emitted-routine-support.js";
import {
  evaluate,
  indexedWrites,
  inputWordHome,
  isIndirectYStore,
  isMemoryWrite,
  namedRoutine,
  scanSource,
  wordMemory,
  wordStep,
} from "./word-update-support.js";
import type { RoutineView } from "./word-update-support.js";

/** Selected NMOS C64 target; the public fixture leaves bounds checks off. */
const target = "c64-pal-prg-kernal-6581";

/** Nested bounds establish a byte-sized address view of two word counters. */
const nestedSource = `module Game;
let data: byte[8] = [;0];
function main(): void {
  for (let i: word = 0; i < 8; i += 1) {
    for (let j: word = i + 1; j < 8; j += 1) {
      data[j] = byte(i);
    }
  }
}
`;

/** Find the unique direct absolute-Y array store, rejecting the old pointer store. */
function directStore(view: RoutineView, base: number): number {
  const positions = view.decoded.flatMap(({ instruction }, position) =>
    instruction.mnemonic === "sta" &&
    instruction.mode === "absoluteIndexed" &&
    instruction.index === "y" &&
    instruction.address === base
      ? [position]
      : [],
  );
  expect(positions, "one absolute-Y store to the authored array").toHaveLength(1);
  expect(
    view.decoded.filter(({ instruction }) => isIndirectYStore(instruction)),
    "no indirect-indexed element store",
  ).toEqual([]);
  return positions[0]!;
}

/** Require a real RAM load, not an immediate or a truncated pointer operand. */
function loadedHome(instruction: Instruction, mnemonic: string): number {
  expect(instruction.mnemonic, "register load").toBe(mnemonic);
  expect(["absolute", "zeroPage"], "direct scalar load").toContain(instruction.mode);
  expect(instruction.address, "resolved scalar home").toBeDefined();
  return instruction.address!;
}

/** Confirm that a byte addressing view has not removed the word's high home. */
function expectWordHome(view: RoutineView, low: number): void {
  const high = view.decoded
    .map((entry) => entry.instruction)
    .filter((instruction) => instruction.address === low + 1);
  expect(
    high.some(
      (instruction) => readMnemonics.has(instruction.mnemonic) || instruction.mnemonic === "inc",
    ),
    `high byte at $${(low + 1).toString(16)} is still read`,
  ).toBe(true);
  expect(
    high.some(isMemoryWrite),
    `high byte at $${(low + 1).toString(16)} still has a written home`,
  ).toBe(true);
}

/**
 * Check the local store block for address staging.
 *
 * The authored body contains only the array assignment. Writes before its final
 * store would therefore still be staging that assignment, not another source
 * operation. Earlier initialization and guard blocks are outside this check.
 */
function expectUnstagedStoreBlock(view: RoutineView, store: number): void {
  let start = store;
  while (start > 0) {
    const previous = view.decoded[start - 1]!.instruction;
    if (previous.mode === "relative" || ["jmp", "jsr", "rts", "rti"].includes(previous.mnemonic))
      break;
    start -= 1;
  }
  expect(
    view.decoded
      .slice(start, store)
      .filter(({ instruction }) => isMemoryWrite(instruction))
      .map(({ instruction }) => instruction.text),
    "no staged address bytes before the element store",
  ).toEqual([]);
}

/** Charge only the isolated load/transfer/store window. */
function windowCost(instructions: readonly Instruction[]): { bytes: number; cycles: number } {
  return instructions.reduce(
    (total, instruction) => {
      const own = cost(instruction);
      return { bytes: total.bytes + own.bytes, cycles: total.cycles + own.cycles };
    },
    { bytes: 0, cycles: 0 },
  );
}

/** Preserve both pointer-byte construction and its indirect store in none mode. */
function expectPointerForm(view: RoutineView, base: number): void {
  const stores = view.decoded.filter(({ instruction }) => isIndirectYStore(instruction));
  expect(stores, "canonical indirect-indexed element store").toHaveLength(1);
  const store = stores[0]!;
  const operand = /\(([^()]+)\)\s*,\s*y\s*$/iu.exec(store.instruction.text);
  expect(operand, "indirect pointer operand").not.toBeNull();
  const pointer = decodeLine(`lda ${operand![1]!}`, view.labels)?.address;
  expect(pointer, "resolved zero-page pointer").toBeDefined();
  expect(pointer!, "pointer occupies zero page").toBeLessThan(0xff);

  const prefix = view.decoded.filter((entry) => entry.lineIndex < store.lineIndex);
  for (const address of [pointer!, pointer! + 1])
    expect(
      prefix.some(
        ({ instruction }) => instruction.mnemonic === "sta" && instruction.address === address,
      ),
      `canonical construction writes pointer byte $${address.toString(16)}`,
    ).toBe(true);
  expect(
    view.decoded.filter(
      ({ instruction }) =>
        instruction.mnemonic === "sta" &&
        instruction.mode === "absoluteIndexed" &&
        instruction.index === "y" &&
        instruction.address === base,
    ),
    "none mode does not introduce direct absolute-Y indexing",
  ).toEqual([]);
}

describe("word views for direct byte-array indexing", () => {
  it.each(["balanced", "size"] as const)(
    "uses a nine-byte direct store window for nested bounded words in %s mode",
    async (mode) => {
      const artifacts = await buildProfileSource(nestedSource, target, mode);
      expect(artifacts.debug).toMatchObject({ profileId: target, optimization: mode });
      expect(artifacts.costs.mode).toBe(mode);
      const view = namedRoutine(artifacts, "main");
      const store = directStore(view, globalAddress(view.labels, "data"));
      const window = view.decoded.slice(store - 2, store + 1).map((entry) => entry.instruction);
      expect(window, "complete store window").toHaveLength(3);
      const j = loadedHome(window[0]!, "ldy");
      const i = loadedHome(window[1]!, "lda");
      expect(j, "index and stored value belong to different counters").not.toBe(i);
      expectWordHome(view, i);
      expectWordHome(view, j);
      expectUnstagedStoreBlock(view, store);
      expect(windowCost(window), "direct store bytes and cycles").toEqual({
        bytes: 9,
        cycles: 13,
      });
    },
    180_000,
  );

  it.each(["balanced", "size"] as const)(
    "reads a shared index/value byte once in a seven-byte window in %s mode",
    async (mode) => {
      const artifacts = await buildProfileSource(scanSource(), target, mode);
      const view = namedRoutine(artifacts, "scan");
      const step = wordStep(view);
      const store = directStore(view, globalAddress(view.labels, "data"));
      const window = view.decoded.slice(store - 2, store + 1).map((entry) => entry.instruction);
      expect(window, "complete shared-byte store window").toHaveLength(3);
      expect(loadedHome(window[0]!, "lda"), "loaded byte is the counter's low home").toBe(step.low);
      expect(window[1]).toMatchObject({ mnemonic: "tay", mode: "implied" });
      expectWordHome(view, step.low);
      expectUnstagedStoreBlock(view, store);
      expect(windowCost(window), "shared-byte store bytes and cycles").toEqual({
        bytes: 7,
        cycles: 11,
      });
    },
    180_000,
  );

  it("loads the index and a different stored variable separately", async () => {
    const source = `module Game;
let data: byte[8];
let k: word = 0;
function scan(seed: word): void {
  for (let i: word = seed; i < 8; i += 1) { data[i] = byte(k); }
}
function main(): void { k = word(peek($D012)); scan(0); }
`;
    const artifacts = await buildProfileSource(source, target, "balanced");
    const view = namedRoutine(artifacts, "scan");
    const step = wordStep(view);
    const store = directStore(view, globalAddress(view.labels, "data"));
    const prefix = view.decoded.slice(0, store).map((entry) => entry.instruction);
    const value = prefix.findLast(clobbersAccumulator);
    expect(value, "stored value has an accumulator producer").toBeDefined();
    expect(loadedHome(value!, "lda"), "stored value is k, not the counter").toBe(
      globalAddress(view.labels, "k"),
    );

    const yPosition = prefix.findLastIndex((instruction) =>
      ["ldy", "tay", "iny", "dey", "jsr"].includes(instruction.mnemonic),
    );
    expect(yPosition, "index has a Y producer").toBeGreaterThanOrEqual(0);
    const index = prefix[yPosition]!;
    if (index.mnemonic === "tay") {
      const producer = prefix.slice(0, yPosition).findLast(clobbersAccumulator);
      expect(producer, "TAY has its own index-byte producer").toBeDefined();
      expect(loadedHome(producer!, "lda"), "TAY transfers the index, not k").toBe(step.low);
    } else {
      expect(loadedHome(index, "ldy"), "Y is loaded from the counter").toBe(step.low);
    }
    expect(step.low, "different source storage is not conflated").not.toBe(
      globalAddress(view.labels, "k"),
    );
  }, 180_000);

  it("preserves all 300 distinct addresses when the bound exceeds one byte", async () => {
    const source = `module Game;
let big: byte[300] = [;0];
function main(): void {
  for (let j: word = 0; j < 300; j += 1) { big[j] = 1; }
}
`;
    const artifacts = await buildProfileSource(source, target, "balanced");
    const view = namedRoutine(artifacts, "main");
    const base = globalAddress(view.labels, "big");
    const stores = indexedWrites(view, evaluate(view, new Map<number, number>()));
    expect(
      stores.map((write) => write.address),
      "the index must not wrap at 256",
    ).toEqual(Array.from({ length: 300 }, (_, index) => (base + index) & 0xffff));
    expect(
      stores.map((write) => write.value),
      "every indexed store retains its value",
    ).toEqual(Array.from({ length: 300 }, () => 1));
  }, 180_000);

  it("retains the high-byte contribution of an unchecked word parameter", async () => {
    const source = `module Game;
let big: byte[300] = [;0];
function work(index: word): void { big[index] = 1; }
function main(): void { work(0); }
`;
    const artifacts = await buildProfileSource(source, target, "balanced");
    const view = namedRoutine(artifacts, "work");
    const input = inputWordHome(view);
    const base = globalAddress(view.labels, "big");
    for (const index of [0, 255, 256, 299, 65535]) {
      const stores = indexedWrites(view, evaluate(view, wordMemory(input, index)));
      expect(
        stores.map(({ address, value }) => ({ address, value })),
        `unchecked word index ${index}`,
      ).toEqual([{ address: (base + index) & 0xffff, value: 1 }]);
    }
  }, 180_000);

  it.each([
    { label: "nested counters", source: nestedSource, name: "main" },
    { label: "a parameter-seeded counter", source: scanSource(), name: "scan" },
  ])(
    "preserves canonical pointer construction for $label in none mode",
    async ({ source, name }) => {
      const artifacts = await buildProfileSource(source, target, "none");
      expect(artifacts.costs.mode).toBe("none");
      const view = namedRoutine(artifacts, name);
      expectPointerForm(view, globalAddress(view.labels, "data"));
    },
    180_000,
  );
});
