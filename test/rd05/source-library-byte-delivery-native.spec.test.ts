import { describe, expect, it } from "vitest";
import {
  libraryEntry,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

/** Boundary bytes expose truncation, inverted sign bits, and stale accumulator/flag reuse. */
const BYTE_VALUES = [0x00, 0x01, 0x7f, 0x80, 0xfe, 0xff] as const;

/** Ordinary byte expressions exercise both global stores and scalar-return consumers. */
const ADJACENT = `module Game;
const FIRST: word = $3301;
const SECOND: word = $3302;
place(at: $3300) let input: byte;
place(at: $3200) let complementResult: byte;
place(at: $3201) let andResult: byte;
place(at: $3202) let orResult: byte;
place(at: $3203) let xorResult: byte;
place(at: $3204) let chainResult: byte;
place(at: $3205) let reverseResult: byte;
place(at: $3206) let returned: byte;
place(at: $3207) let returnedChain: byte;
place(at: $3208) let volatileResult: byte;
place(at: $3209) let orderedResult: byte;
place(at: $320a) let complementOr: byte;
place(at: $320b) let complementXor: byte;
place(at: $320c) let xorAnd: byte;
export function complement(value: byte): byte { return ~value; }
export function transform(value: byte): byte { return (~value & $7f) ^ $20; }
export function step(): void {
  complementResult = ~input;
  andResult = input & $7f;
  orResult = input | $80;
  xorResult = input ^ $a5;
  chainResult = (~input & $7f) ^ $20;
  reverseResult = ~((input | $20) ^ $a5);
  returned = complement(input);
  returnedChain = transform(input);
  volatileResult = ~peek(FIRST);
  orderedResult = (~(peek(FIRST) | peek(SECOND)) & $7f) ^ $20;
  complementOr = ~input | $80;
  complementXor = ~input ^ $a5;
  xorAnd = (input ^ $a5) & $7f;
}
export function observed(): void { }
export function main(): void { while (true) { step(); observed(); } }`;

/** Retained values remain valid after additional reads, calls, source writes and block boundaries. */
const FALLBACK = `module Game;
const FIRST: word = $3301;
const SECOND: word = $3302;
place(at: $3300) let input: byte;
place(at: $3310) let wordInput: word;
place(at: $3210) let first: byte;
place(at: $3211) let second: byte;
place(at: $3212) let blockResult: byte;
place(at: $3213) let predicate: byte;
place(at: $3214) let noiseSink: byte;
place(at: $3215) let orderedResult: byte;
place(at: $3216) let bitFirst: byte;
place(at: $3217) let bitSecond: byte;
place(at: $3220) let wordResult: word;
place(at: $3222) let wordChain: word;
function interfere(): void { input = peek(SECOND); }
function replace(): byte {
  poke(FIRST, peek(SECOND));
  return peek(SECOND);
}
export function step(): void {
  let saved: byte = ~input;
  let savedBits: byte = input ^ $a5;
  first = saved;
  bitFirst = savedBits;
  noiseSink = peek(SECOND);
  interfere();
  second = saved;
  bitSecond = savedBits;
  if (peek(SECOND) != 0) { blockResult = saved; }
  if (saved == 0) { predicate = 1; } else { predicate = 0; }
  orderedResult = (~peek(FIRST)) ^ replace();
  wordResult = ~wordInput;
  wordChain = (~wordInput & $7fff) ^ $2000;
}
export function observed(): void { }
export function main(): void { while (true) { step(); observed(); } }`;

describe("adjacent byte delivery numeric and effect semantics", () => {
  it.each(sourceLibraryProfiles)(
    "should preserve all byte boundaries, ordered volatile reads and one source write on %s",
    async (profile) => {
      // Independent arithmetic expectations use the specified eight-bit complement and bitwise rules.
      await withLibraryBuild(ADJACENT, "module Extra;", profile, async (artifacts, built) => {
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          for (const value of BYTE_VALUES) {
            const first = value ^ 0x80;
            const second = value ^ 0x7f;
            const complement = value ^ 0xff;
            const chain = (complement & 0x7f) ^ 0x20;
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
            await monitor.writeMemory(0x3300, Uint8Array.from([value, first, second]));
            await monitor.writeMemory(0x3200, Uint8Array.from(Array<number>(13).fill(0xcc)));
            const entry = await monitor.readCpuRegisters();
            const reads = [await monitor.setAccessTracepoint(0x3301, "load")];
            reads.push(await monitor.setAccessTracepoint(0x3302, "load"));
            const writes: number[] = [];
            for (let address = 0x3200; address <= 0x320c; address += 1)
              writes.push(await monitor.setAccessTracepoint(address, "store"));
            const sourceWrites: number[] = [];
            for (let address = 0x3300; address <= 0x3302; address += 1)
              sourceWrites.push(await monitor.setAccessTracepoint(address, "store"));
            const traces = [...reads, ...writes, ...sourceWrites];
            try {
              monitor.takeCheckpointHits();
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
              const exit = await monitor.readCpuRegisters();
              // step and observed are both direct main calls: compare equal hardware-stack depth.
              expect(exit.sp).toBe(entry.sp);
              expect(exit.p & 0x0c).toBe(entry.p & 0x0c);
              expect(monitor.takeCheckpointHits().filter((id) => traces.includes(id))).toEqual([
                ...writes.slice(0, 8),
                reads[0],
                writes[8],
                reads[0],
                reads[1],
                writes[9],
                ...writes.slice(10),
              ]);
              expect(Array.from(await monitor.readMemory(0x3200, 0x320c))).toEqual([
                complement,
                value & 0x7f,
                value | 0x80,
                value ^ 0xa5,
                chain,
                (value | 0x20) ^ 0xa5 ^ 0xff,
                complement,
                chain,
                first ^ 0xff,
                (((first | second) ^ 0xff) & 0x7f) ^ 0x20,
                complement | 0x80,
                complement ^ 0xa5,
                (value ^ 0xa5) & 0x7f,
              ]);
              expect(Array.from(await monitor.readMemory(0x3300, 0x3302))).toEqual([
                value,
                first,
                second,
              ]);
            } finally {
              for (const trace of traces) await monitor.deleteCheckpoint(trace);
            }
          }
        });
      });
    },
    180_000,
  );

  it.each(sourceLibraryProfiles)(
    "should materialize saved bytes across uses calls effects and blocks and preserve word width on %s",
    async (profile) => {
      // Excluded forwarding forms must keep their existing behavior; this test imposes no new cost.
      await withLibraryBuild(FALLBACK, "module Extra;", profile, async (artifacts, built) => {
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          for (const [value, word] of [
            [0x00, 0x0000],
            [0x01, 0x0001],
            [0x7f, 0x7f80],
            [0x80, 0x8000],
            [0xfe, 0xff00],
            [0xff, 0xffff],
          ] as const) {
            const saved = value ^ 0xff;
            const first = value ^ 0xa5;
            const second = value === 0xff ? 0x80 : value === 0 ? 0 : value ^ 0xff;
            const wordResult = word ^ 0xffff;
            const wordChain = (wordResult & 0x7fff) ^ 0x2000;
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
            await monitor.writeMemory(0x3300, Uint8Array.from([value, first, second]));
            await monitor.writeMemory(0x3310, Uint8Array.from([word & 0xff, word >>> 8]));
            await monitor.writeMemory(0x3210, Uint8Array.from(Array<number>(8).fill(0xcc)));
            await monitor.writeMemory(0x3220, Uint8Array.from(Array<number>(4).fill(0xcc)));
            const entry = await monitor.readCpuRegisters();
            const reads = [await monitor.setAccessTracepoint(0x3301, "load")];
            reads.push(await monitor.setAccessTracepoint(0x3302, "load"));
            const inputWrite = await monitor.setAccessTracepoint(0x3300, "store");
            const firstWrite = await monitor.setAccessTracepoint(0x3301, "store");
            const writes: number[] = [];
            for (let address = 0x3210; address <= 0x3217; address += 1)
              writes.push(await monitor.setAccessTracepoint(address, "store"));
            const wordWrites: number[] = [];
            for (let address = 0x3220; address <= 0x3223; address += 1)
              wordWrites.push(await monitor.setAccessTracepoint(address, "store"));
            const traces = [...reads, inputWrite, firstWrite, ...writes, ...wordWrites];
            try {
              monitor.takeCheckpointHits();
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
              const exit = await monitor.readCpuRegisters();
              expect(exit.sp).toBe(entry.sp);
              expect(exit.p & 0x0c).toBe(entry.p & 0x0c);
              expect(monitor.takeCheckpointHits().filter((id) => traces.includes(id))).toEqual([
                writes[0],
                writes[6],
                reads[1],
                writes[4],
                reads[1],
                inputWrite,
                writes[1],
                writes[7],
                reads[1],
                ...(second !== 0 ? [writes[2]] : []),
                writes[3],
                reads[0],
                reads[1],
                firstWrite,
                reads[1],
                writes[5],
                ...wordWrites,
              ]);
              expect(Array.from(await monitor.readMemory(0x3210, 0x3217))).toEqual([
                saved,
                saved,
                second !== 0 ? saved : 0xcc,
                saved === 0 ? 1 : 0,
                second,
                first ^ 0xff ^ second,
                value ^ 0xa5,
                value ^ 0xa5,
              ]);
              expect(Array.from(await monitor.readMemory(0x3220, 0x3223))).toEqual([
                wordResult & 0xff,
                wordResult >>> 8,
                wordChain & 0xff,
                wordChain >>> 8,
              ]);
              expect(Array.from(await monitor.readMemory(0x3300, 0x3302))).toEqual([
                second,
                second,
                second,
              ]);
            } finally {
              for (const trace of traces) await monitor.deleteCheckpoint(trace);
            }
          }
        });
      });
    },
    180_000,
  );
});
