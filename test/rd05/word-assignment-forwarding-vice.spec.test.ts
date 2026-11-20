import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { buildProfileSource, profileRecords } from "./profile-fixture.js";

const PROFILE = "c64-pal-prg-kernal-6581";
const OPTIMIZATIONS = ["none", "balanced", "speed", "size"] as const;
type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;

/** Six passes are enough for every value below to cross a byte boundary and keep going. */
const PASSES = 6;

/** Split a 16-bit value the way these programs publish it: low byte, then high byte. */
function wordBytes(value: number): readonly number[] {
  const wrapped = value & 0xffff;
  return [wrapped & 0xff, wrapped >>> 8];
}

/** Reject a missing report field instead of letting absent evidence read as address zero. */
function numberField(record: Record<string, unknown>, name: string): number {
  const value = record[name];
  if (typeof value !== "number" || !Number.isSafeInteger(value))
    throw new Error(`Missing or noninteger report field: ${name}`);
  return value;
}

/**
 * Locate the single application store to one hardware register inside declared
 * CPU code. Searching code intervals keeps asset bytes that happen to resemble
 * an absolute store out of the result.
 */
function uniqueStorePc(artifacts: Artifacts, address: number): number {
  const origin = artifacts.prg.readUInt16LE(0);
  const intervals = profileRecords(artifacts.memory.intervals).filter(
    (interval) => interval.addressSpaceId === "cpu16" && interval.kind === "code",
  );
  expect(intervals.length).toBeGreaterThan(0);
  const stores: number[] = [];
  for (const interval of intervals) {
    const start = numberField(interval, "start");
    const end = numberField(interval, "end");
    expect(end - start).toBe(numberField(interval, "size"));
    expect(start).toBeGreaterThanOrEqual(origin);
    expect(end - origin + 2).toBeLessThanOrEqual(artifacts.prg.length);
    for (let pc = start; pc + 3 <= end; pc += 1) {
      const offset = pc - origin + 2;
      if (
        artifacts.prg[offset] === 0x8d &&
        artifacts.prg[offset + 1] === (address & 0xff) &&
        artifacts.prg[offset + 2] === address >>> 8
      )
        stores.push(pc);
    }
  }
  expect(stores, `one store to $${address.toString(16)}`).toHaveLength(1);
  const pc = stores[0];
  if (pc === undefined) throw new Error("Publication store was not found");
  return pc;
}

/** One program whose published hardware registers are predicted from the source alone. */
interface Publication {
  /** Blend65 source that republishes every observed register on every loop pass. */
  readonly source: string;
  /** Register written last in source order; execution is observed just after it. */
  readonly anchor: number;
  /** First and last register read back, inclusive. */
  readonly first: number;
  readonly last: number;
  /** Register contents after the given zero-based loop pass has completed. */
  readonly expected: (pass: number) => readonly number[];
}

/**
 * Run one published program on the real CPU and return the observed register
 * contents after each loop pass. Execution stops immediately after the store
 * that publishes the last register, so every register of that pass is settled.
 */
async function observePublications(
  publication: Publication,
  optimization: (typeof OPTIMIZATIONS)[number],
): Promise<readonly (readonly number[])[]> {
  const artifacts = await buildProfileSource(publication.source, PROFILE, optimization);
  const settled = uniqueStorePc(artifacts, publication.anchor) + 3;
  const root = await mkdtemp(join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "word-assignment-vice-"));
  try {
    const prgPath = join(root, "program.prg");
    await writeFile(prgPath, artifacts.prg);
    const started = await startVice(prgPath, 100_000_000, PROFILE);
    if ("kind" in started) throw new Error(`VICE is required: ${started.reason}`);
    const monitor = started.monitor;
    const checkpoints = new Set<number>();
    try {
      const checkpoint = await monitor.setExecuteCheckpoint(settled);
      checkpoints.add(checkpoint);
      const samples: (readonly number[])[] = [];
      for (let pass = 0; pass < PASSES; pass += 1) {
        // The monitor must already be listening when execution reaches the stop.
        const stopped = monitor.waitForStop(30_000);
        await monitor.resume();
        expect(await stopped).toBe(settled);
        const registers = await monitor.readIo(publication.first, publication.last);
        expect(registers).toHaveLength(publication.last - publication.first + 1);
        samples.push([...registers]);
      }
      return samples;
    } finally {
      try {
        for (const checkpoint of checkpoints) await monitor.deleteCheckpoint(checkpoint);
      } finally {
        await stopVice(started);
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Compare each observed pass with the value the source prescribes for it. */
async function expectPublishedValues(
  publication: Publication,
  optimization: (typeof OPTIMIZATIONS)[number],
): Promise<void> {
  const samples = await observePublications(publication, optimization);
  expect(samples).toEqual(
    Array.from({ length: PASSES }, (_unused, pass) => [...publication.expected(pass)]),
  );
}

/**
 * The destination is the variable the arithmetic reads. The low byte of the
 * destination is written before the high byte of the operand is needed, so a
 * wrong store order shows up here as a wrong high byte. Addition crosses 256
 * upwards on the first pass and subtraction borrows downwards on the same pass.
 */
const SAME_VARIABLE: Publication = {
  source: `module Game;
function main(): void {
  let up: word = $00FE;
  let down: word = $0100;
  while (true) {
    up = up + 2;
    down = down - 2;
    poke($D000, lo(up));
    poke($D001, hi(up));
    poke($D002, lo(down));
    poke($D003, hi(down));
  }
}`,
  anchor: 0xd003,
  first: 0xd000,
  last: 0xd003,
  expected: (pass) => [
    ...wordBytes(0x00fe + 2 * (pass + 1)),
    ...wordBytes(0x0100 - 2 * (pass + 1)),
  ],
};

/**
 * A separate destination must receive the sum while the operand keeps its own
 * value, and the same arithmetic published straight to hardware must agree
 * with the value stored in the variable.
 */
const SEPARATE_VARIABLE: Publication = {
  source: `module Game;
function main(): void {
  let x: word = $00FE;
  let y: word = 0;
  while (true) {
    x = x + 1;
    y = x + 2;
    poke($D000, lo(x));
    poke($D001, hi(x));
    poke($D002, lo(y));
    poke($D003, hi(y));
    poke($D004, lo(x + 2));
    poke($D005, hi(x + 2));
  }
}`,
  anchor: 0xd005,
  first: 0xd000,
  last: 0xd005,
  expected: (pass) => {
    const x = 0x00ff + pass;
    return [...wordBytes(x), ...wordBytes(x + 2), ...wordBytes(x + 2)];
  },
};

/**
 * Statements sit between the arithmetic and the use of its result, and the
 * result is then read more than once. Both are cases where writing the
 * destination early could be observed, so both values are checked.
 */
const DELAYED_AND_REUSED: Publication = {
  source: `module Game;
function main(): void {
  let x: word = $00FD;
  let sum: word = 0;
  let twice: word = 0;
  let other: word = 0;
  while (true) {
    x = x + 1;
    sum = x + 2;
    other = other + 3;
    poke($D020, 14);
    twice = sum + sum;
    poke($D000, lo(sum));
    poke($D001, hi(sum));
    poke($D002, lo(twice));
    poke($D003, hi(twice));
    poke($D004, lo(other));
    poke($D005, hi(other));
  }
}`,
  anchor: 0xd005,
  first: 0xd000,
  last: 0xd005,
  expected: (pass) => {
    const sum = 0x00fe + pass + 2;
    return [...wordBytes(sum), ...wordBytes(sum + sum), ...wordBytes(3 * (pass + 1))];
  },
};

/**
 * Indexed and field destinations are parts of a larger object. Writing one
 * element or field must leave its neighbour alone, so the untouched neighbour
 * is published alongside the written place.
 */
const PARTIAL_DESTINATIONS: Publication = {
  source: `module Game;
struct Pair { first: word; second: word; }
let slots: word[2] = [$1234, 0];
let pair: Pair = { first: $5678, second: 0 };
function main(): void {
  let x: word = $00FD;
  let index: byte = 1;
  while (true) {
    x = x + 1;
    slots[index] = x + 2;
    pair.second = x + 4;
    poke($D000, lo(slots[index]));
    poke($D001, hi(slots[index]));
    poke($D002, lo(pair.second));
    poke($D003, hi(pair.second));
    poke($D004, lo(slots[0]));
    poke($D005, hi(slots[0]));
    poke($D006, lo(pair.first));
    poke($D007, hi(pair.first));
  }
}`,
  anchor: 0xd007,
  first: 0xd000,
  last: 0xd007,
  expected: (pass) => {
    const x = 0x00fe + pass;
    return [
      ...wordBytes(x + 2),
      ...wordBytes(x + 4),
      ...wordBytes(0x1234),
      ...wordBytes(0x5678),
    ];
  },
};

/** Two operations in one expression produce an intermediate result that is never stored. */
const CHAINED_ARITHMETIC: Publication = {
  source: `module Game;
function main(): void {
  let b: word = $00FD;
  let c: word = 5;
  let a: word = 0;
  while (true) {
    b = b + 1;
    c = c + 2;
    a = b + c - 2;
    poke($D000, lo(a));
    poke($D001, hi(a));
    poke($D002, lo(b));
    poke($D003, hi(b));
    poke($D004, lo(c));
    poke($D005, hi(c));
  }
}`,
  anchor: 0xd005,
  first: 0xd000,
  last: 0xd005,
  expected: (pass) => {
    const b = 0x00fe + pass;
    const c = 7 + 2 * pass;
    return [...wordBytes(b + c - 2), ...wordBytes(b), ...wordBytes(c)];
  },
};

/**
 * Signed 16-bit values descend through zero, so the high byte becomes $FF
 * while the low byte wraps. The published bytes are the two's complement
 * representation of the signed result.
 */
const SIGNED_DESTINATION: Publication = {
  source: `module Game;
function main(): void {
  let s: sword = 2;
  let t: sword = 0;
  while (true) {
    s = s - 2;
    t = s - 2;
    poke($D000, lo(word(s)));
    poke($D001, hi(word(s)));
    poke($D002, lo(word(t)));
    poke($D003, hi(word(t)));
  }
}`,
  anchor: 0xd003,
  first: 0xd000,
  last: 0xd003,
  expected: (pass) => {
    const s = 2 - 2 * (pass + 1);
    return [...wordBytes(s), ...wordBytes(s - 2)];
  },
};

describe.sequential("whole-word assignment values on the real CPU", () => {
  for (const optimization of OPTIMIZATIONS) {
    it(`should keep in-place word addition and subtraction exact in ${optimization}`, async () => {
      await expectPublishedValues(SAME_VARIABLE, optimization);
    }, 300_000);
  }

  for (const [name, publication] of [
    ["a separate destination leaves its operand alone", SEPARATE_VARIABLE],
    ["an intervening statement and a reused result", DELAYED_AND_REUSED],
    ["an array element and a struct field destination", PARTIAL_DESTINATIONS],
    ["chained arithmetic in one expression", CHAINED_ARITHMETIC],
    ["a signed word destination crossing zero", SIGNED_DESTINATION],
  ] as const) {
    it(`should compute exact word values with ${name}`, async () => {
      await expectPublishedValues(publication, "none");
    }, 300_000);
  }
});
