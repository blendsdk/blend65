/**
 * Specification tests for the shared observables runner — the single
 * assertion source both a fixture's VICE suite and its hand-written twin
 * consume. Derived from the runner's documented behavior, not from reading
 * the implementation.
 *
 * Byte checks and block checks are proven against a FAKE driver in CI; the
 * stopped-machine loop-head landmarks are proven live on VICE by the
 * fixture-side suites (Local tier).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { AssertionError } from "../run/assertions.js";
import { FakeDriver } from "./fake-driver.js";
import { assertObservables, type ProgramObservables } from "./observables.js";

/** The repository root (this file lives at packages/test-harness/src/testing). */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

/** The committed balloon sprite asset used as the block-check oracle. */
const SPRITE_FILE = "examples/balloon/balloon.bin";
/** Where the balloon twin stages its sprite block. */
const SPRITE_BLOCK = 0x0340;

/** A fake-driver memory image holding `bytes` starting at `start`. */
function memoryImage(start: number, bytes: Uint8Array | number[]): Map<number, number> {
  const memory = new Map<number, number>();
  for (let i = 0; i < bytes.length; i++) {
    memory.set(start + i, bytes[i]);
  }
  return memory;
}

describe("Specification: assertObservables byte checks against a fake driver", () => {
  const checkAt7: ProgramObservables = {
    landmarks: [],
    checks: [{ address: 0xc000, value: 7 }],
  };

  it("should pass when the memory image matches every byte check", async () => {
    const driver = new FakeDriver({ memory: memoryImage(0xc000, [7]) });
    await expect(assertObservables(driver, checkAt7)).resolves.toBeUndefined();
  });

  it("should reject with an AssertionError naming address, expected, and actual on a mismatch", async () => {
    const driver = new FakeDriver({ memory: memoryImage(0xc000, [9]) });
    const failure = assertObservables(driver, checkAt7);
    await expect(failure).rejects.toBeInstanceOf(AssertionError);
    await expect(assertObservables(driver, checkAt7)).rejects.toThrow(/\$c000.*0x07.*0x09/);
  });

  it("should walk a memory landmark before running the checks", async () => {
    const driver = new FakeDriver({ memory: memoryImage(0xc000, [7]) });
    const observables: ProgramObservables = {
      landmarks: [{ kind: "memory", address: 0xc000, value: 7 }],
      checks: [{ address: 0xc000, value: 7 }],
    };
    await expect(assertObservables(driver, observables)).resolves.toBeUndefined();
  });
});

describe("Specification: assertObservables block checks against a committed asset file", () => {
  const spriteBytes = readFileSync(join(REPO_ROOT, SPRITE_FILE));
  const blockObservables: ProgramObservables = {
    landmarks: [],
    checks: [{ address: SPRITE_BLOCK, bytesFile: SPRITE_FILE }],
  };

  it("holds the 63-byte sprite asset this suite stages", () => {
    expect(spriteBytes.length).toBe(63);
  });

  it("should pass when the staged block matches the asset byte-for-byte", async () => {
    const driver = new FakeDriver({ memory: memoryImage(SPRITE_BLOCK, spriteBytes) });
    await expect(assertObservables(driver, blockObservables)).resolves.toBeUndefined();
  });

  it("should reject naming the file and the mismatching offset when one byte differs", async () => {
    const flipped = Uint8Array.from(spriteBytes);
    flipped[17] ^= 0xff;
    const driver = new FakeDriver({ memory: memoryImage(SPRITE_BLOCK, flipped) });
    const failure = assertObservables(driver, blockObservables);
    await expect(failure).rejects.toBeInstanceOf(AssertionError);
    await expect(assertObservables(driver, blockObservables)).rejects.toThrow(
      /balloon\.bin.*byte 17\b/,
    );
  });

  it("should reject naming the file and both lengths on a read shortfall", async () => {
    /** A driver whose block reads come back truncated. */
    class ShortReadDriver extends FakeDriver {
      override async readMemory(start: number, length: number): Promise<Uint8Array> {
        return (await super.readMemory(start, Math.min(length, 10))).slice(0, 10);
      }
    }
    const driver = new ShortReadDriver({ memory: memoryImage(SPRITE_BLOCK, spriteBytes) });
    await expect(assertObservables(driver, blockObservables)).rejects.toThrow(
      /balloon\.bin.*63.*10/,
    );
  });
});
