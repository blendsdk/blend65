/**
 * Private word increments commit directly without scratch copies while retaining
 * full-width guards and carry. Global word increments preserve ordered ordinary
 * stores rather than introducing NMOS read-modify-write bus effects.
 */
import { describe, expect, it } from "vitest";
import { buildProfileSource } from "../rd05/profile-fixture.js";
import { cost, globalAddress, routineBytes } from "./emitted-routine-support.js";
import {
  evaluate,
  indexedWrites,
  inputWordHome,
  isMemoryWrite,
  namedRoutine,
  scanSource,
  wordMemory,
  wordStep,
} from "./word-update-support.js";
import type { RoutineView, WordStep } from "./word-update-support.js";

/** Selected NMOS C64 target; bounds instrumentation is off by default. */
const target = "c64-pal-prg-kernal-6581";

/**
 * Keep the global update reachable beside the bounded-array witness.
 *
 * The installed-handler control shares the global explicitly, so the ordinary
 * foreground update cannot be replaced by an NMOS increment instruction.
 */
function totalSource(withHandler = false): string {
  return `module Game;
${withHandler ? "import { setNMI, restoreNMI } from c64.system;\n" : ""}let data: byte[8] = [;0];
let total: word = 0;
${withHandler ? "interrupt function handler(): void { total = 1; }\n" : ""}function touch(): void { total += 1; }
function main(): void {
  ${withHandler ? "setNMI(&handler);\n  " : ""}touch();
  for (let i: word = 0; i < 8; i += 1) { data[i] = byte(i); }
  ${withHandler ? "restoreNMI();\n" : ""}
}
`;
}

/** Require the private update to write its two home bytes and no staging RAM. */
function expectDirectPrivateStep(view: RoutineView, step: WordStep): void {
  const writes = view.decoded
    .slice(step.start, step.end + 1)
    .map((entry) => entry.instruction)
    .filter(isMemoryWrite);
  expect(
    writes.map((instruction) => instruction.address),
    "update writes only the low and high counter homes, in order",
  ).toEqual([step.low, step.low + 1]);
  expect(
    writes.map((instruction) => instruction.mnemonic),
    "private updates use stores or full-width increment instructions",
  ).toSatisfy((mnemonics: string[]) =>
    mnemonics.every((mnemonic) => mnemonic === "sta" || mnemonic === "inc"),
  );
}

/**
 * Preserve the old two-byte staging and reloads when optimization is disabled.
 *
 * Merely finding extra stores would not prove preservation: both staged bytes
 * must actually be read back before their destination bytes are committed.
 */
function expectStagedStep(view: RoutineView, step: WordStep): void {
  const code = view.decoded.slice(step.start, step.end + 1).map((entry) => entry.instruction);
  const writes = code
    .map((instruction, position) => ({ instruction, position }))
    .filter(({ instruction }) => isMemoryWrite(instruction));
  expect(writes, "two scratch stores followed by two destination stores").toHaveLength(4);
  const scratch = writes[0]!.instruction.address;
  expect(scratch, "resolved staging home").toBeDefined();
  expect([step.low, step.low + 1], "staging is distinct from the destination").not.toContain(
    scratch,
  );
  expect(
    writes.map(({ instruction }) => ({
      mnemonic: instruction.mnemonic,
      address: instruction.address,
    })),
    "canonical staged word update",
  ).toEqual([
    { mnemonic: "sta", address: scratch },
    { mnemonic: "sta", address: scratch! + 1 },
    { mnemonic: "sta", address: step.low },
    { mnemonic: "sta", address: step.low + 1 },
  ]);

  for (const byte of [0, 1]) {
    const staged = writes[byte]!;
    const committed = writes[byte + 2]!;
    expect(
      code
        .slice(staged.position + 1, committed.position)
        .some(
          (instruction) =>
            instruction.mnemonic === "lda" && instruction.address === scratch! + byte,
        ),
      `staged byte ${byte} is reloaded before its destination store`,
    ).toBe(true);
  }
}

/** Require ordered ordinary stores to both global bytes without NMOS INC writes. */
function expectGlobalWordStores(view: RoutineView, low: number): void {
  const writes = view.decoded
    .map((entry) => entry.instruction)
    .filter(
      (instruction) =>
        isMemoryWrite(instruction) &&
        (instruction.address === low || instruction.address === low + 1),
    );
  const lowPositions = writes.flatMap((instruction, position) =>
    instruction.address === low ? [position] : [],
  );
  const highPositions = writes.flatMap((instruction, position) =>
    instruction.address === low + 1 ? [position] : [],
  );
  expect(lowPositions.length, "global low byte is written").toBeGreaterThan(0);
  expect(highPositions.length, "global high byte is written").toBeGreaterThan(0);
  expect(Math.max(...lowPositions), "all low-byte commits precede high-byte commits").toBeLessThan(
    Math.min(...highPositions),
  );
  expect(
    writes.map((instruction) => instruction.mnemonic),
    "global commits are ordinary stores, not read-modify-write instructions",
  ).toEqual(writes.map(() => "sta"));
}

describe("direct full-width word updates", () => {
  it.each(["balanced", "size"] as const)(
    "updates a private word home without a scratch copy in %s mode",
    async (mode) => {
      const artifacts = await buildProfileSource(scanSource(), target, mode);
      const view = namedRoutine(artifacts, "scan");
      expectDirectPrivateStep(view, wordStep(view));
    },
    180_000,
  );

  it("preserves the private increment's carry and word wrap", async () => {
    const artifacts = await buildProfileSource(scanSource(), target, "balanced");
    const view = namedRoutine(artifacts, "scan");
    const step = wordStep(view);
    for (const seed of [0, 7, 255, 256, 65535]) {
      const result = evaluate(view, wordMemory(step.low, seed), step);
      const actual = result.memory.get(step.low)! + (result.memory.get(step.low + 1)! << 8);
      expect(actual, `full-width increment of ${seed}`).toBe((seed + 1) & 0xffff);
    }
  }, 180_000);

  it("executes the body only for full-word seeds below eight", async () => {
    const artifacts = await buildProfileSource(scanSource(), target, "balanced");
    const view = namedRoutine(artifacts, "scan");
    const input = inputWordHome(view);
    const base = globalAddress(view.labels, "data");
    for (const seed of [0, 1, 2, 3, 4, 5, 6, 7, 8, 255, 256, 65535]) {
      const stores = indexedWrites(view, evaluate(view, wordMemory(input, seed)));
      const indices =
        seed < 8 ? Array.from({ length: 8 - seed }, (_, offset) => seed + offset) : [];
      expect(
        stores.map(({ address, value }) => ({ address, value })),
        `body stores for word seed ${seed}`,
      ).toEqual(indices.map((index) => ({ address: base + index, value: index })));
    }
  }, 180_000);

  it("keeps the word guard with an installed NMI without prescribing register reuse", async () => {
    const artifacts = await buildProfileSource(scanSource(true), target, "balanced");
    const view = namedRoutine(artifacts, "scan");
    const input = inputWordHome(view);
    const base = globalAddress(view.labels, "data");
    for (const seed of [0, 256, 65535]) {
      const stores = indexedWrites(view, evaluate(view, wordMemory(input, seed)));
      expect(
        stores.map(({ address, value }) => ({ address, value })),
        `foreground word guard for seed ${seed}`,
      ).toEqual(
        seed === 0
          ? Array.from({ length: 8 }, (_, index) => ({
              address: base + index,
              value: index,
            }))
          : [],
      );
    }
  }, 180_000);

  it.each(["balanced", "size"] as const)(
    "updates the global with an eighteen-byte ordinary-store chain in %s mode",
    async (mode) => {
      const artifacts = await buildProfileSource(totalSource(), target, mode);
      const view = namedRoutine(artifacts, "touch");
      const total = globalAddress(view.labels, "total");
      const code = view.decoded.map((entry) => entry.instruction);
      expect(
        code.map((instruction) => instruction.mnemonic),
        "complete touch body",
      ).toEqual(["lda", "clc", "adc", "sta", "lda", "adc", "sta", "rts"]);
      expect(code[0]).toMatchObject({ mode: "absolute", address: total });
      expect(code[2]).toMatchObject({ mode: "immediate", immediate: 1 });
      expect(code[3]).toMatchObject({ mode: "absolute", address: total });
      expect(code[4]).toMatchObject({ mode: "absolute", address: total + 1 });
      expect(code[5]).toMatchObject({ mode: "immediate", immediate: 0 });
      expect(code[6]).toMatchObject({ mode: "absolute", address: total + 1 });
      expectGlobalWordStores(view, total);
      expect(routineBytes(view.decoded), "touch bytes including RTS").toBe(18);
      expect(
        code.reduce((cycles, instruction) => cycles + cost(instruction).cycles, 0),
        "touch cycles including RTS",
      ).toBe(28);
    },
    180_000,
  );

  it("keeps ordered full-width global stores while a sharing NMI is installed", async () => {
    const artifacts = await buildProfileSource(totalSource(true), target, "balanced");
    const view = namedRoutine(artifacts, "touch");
    expectGlobalWordStores(view, globalAddress(view.labels, "total"));
  }, 180_000);

  it.each([
    { label: "private", source: scanSource(), name: "scan", global: false },
    { label: "global", source: totalSource(), name: "touch", global: true },
  ])(
    "preserves the canonical staged $label word update in none mode",
    async (witness) => {
      const artifacts = await buildProfileSource(witness.source, target, "none");
      expect(artifacts.costs.mode).toBe("none");
      const view = namedRoutine(artifacts, witness.name);
      const step = wordStep(view);
      if (witness.global)
        expect(step.low, "updated global home").toBe(globalAddress(view.labels, "total"));
      expectStagedStep(view, step);
    },
    180_000,
  );
});
