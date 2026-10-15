import { describe, expect, it } from "vitest";
import {
  libraryEntry,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

/** All byte values reach both ordinary storage and the public byte-parameter ABI. */
const SOURCE = `module Game;
const FIRST: word = $3301;
place(at: $3300) let input: byte;
place(at: $3200) let normalSeven: byte;
place(at: $3201) let volatileSeven: byte;
place(at: $3202) let returnedSeven: byte;
place(at: $3203) let normalSix: byte;
place(at: $3204) let volatileSix: byte;
place(at: $3205) let returnedSix: byte;
function seven(value: byte): byte { return (~value & $7f) ^ $20; }
function six(value: byte): byte { return (~value & $3f) ^ $12; }
export function step(): void {
  normalSeven = (~input & $7f) ^ $20;
  volatileSeven = (~peek(FIRST) & $7f) ^ $20;
  returnedSeven = seven(input);
  normalSix = (~input & $3f) ^ $12;
  volatileSix = (~peek(FIRST) & $3f) ^ $12;
  returnedSix = six(input);
}
export function observed(): void { }
export function main(): void { while (true) { step(); observed(); } }`;

/** Multiple uses and intervening effects preserve each saved intermediate, including full words. */
const FALLBACK = `module Game;
const FIRST: word = $3301;
const SECOND: word = $3302;
place(at: $3300) let input: byte;
place(at: $3304) let wordInput: word;
place(at: $3210) let complementFirst: byte;
place(at: $3211) let maskedFirst: byte;
place(at: $3212) let complementSecond: byte;
place(at: $3213) let maskedSecond: byte;
place(at: $3214) let finalResult: byte;
place(at: $3215) let noiseSink: byte;
place(at: $3216) let orderedResult: byte;
place(at: $3217) let orderedFirst: byte;
place(at: $3218) let orderedSecond: byte;
place(at: $3220) let wordResult: word;
function interfere(): void { input = peek(SECOND); }
function readOther(): byte { noiseSink = peek(SECOND); return peek(SECOND); }
export function step(): void {
  let complemented: byte = ~input;
  let masked: byte = complemented & $7f;
  complementFirst = complemented;
  maskedFirst = masked;
  noiseSink = peek(SECOND);
  interfere();
  complementSecond = complemented;
  maskedSecond = masked;
  finalResult = masked ^ $20;
  orderedResult = (~peek(FIRST) & $7f) ^ readOther();
  let saved: byte = (~peek(FIRST) & $7f) ^ $20;
  orderedFirst = saved;
  noiseSink = peek(SECOND);
  orderedSecond = saved;
  wordResult = (~wordInput & $7fff) ^ $2000;
}
export function observed(): void { }
export function main(): void { while (true) { step(); observed(); } }`;

describe("disposable byte-chain behavior", () => {
  it.each(sourceLibraryProfiles)(
    "should produce every byte result with one ordered volatile read per expression and one final write on %s",
    async (profile) => {
      // The numeric oracle uses width-limited complement directly, never a generated-code control.
      await withLibraryBuild(SOURCE, "module Extra;", profile, async (artifacts, built) => {
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
          const read = await monitor.setAccessTracepoint(0x3301, "load");
          const inputWrites = [await monitor.setAccessTracepoint(0x3300, "store")];
          inputWrites.push(await monitor.setAccessTracepoint(0x3301, "store"));
          const writes: number[] = [];
          for (let address = 0x3200; address <= 0x3205; address += 1)
            writes.push(await monitor.setAccessTracepoint(address, "store"));
          const traces = [read, ...inputWrites, ...writes];
          try {
            for (let value = 0; value < 256; value += 1) {
              if (value !== 0) await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
              // xor maps the volatile source bijectively across all 256 bytes too.
              const volatile = value ^ 0x55;
              await monitor.writeMemory(0x3300, Uint8Array.from([value, volatile]));
              await monitor.writeMemory(0x3200, Uint8Array.from(Array<number>(6).fill(0xcc)));
              const entry = await monitor.readCpuRegisters();
              monitor.takeCheckpointHits();
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
              const exit = await monitor.readCpuRegisters();
              // step and observed are equal-depth direct main calls; A/X/Y have no outgoing promise.
              expect(exit.sp).toBe(entry.sp);
              expect(exit.p & 0x0c).toBe(entry.p & 0x0c);
              expect(monitor.takeCheckpointHits().filter((id) => traces.includes(id))).toEqual([
                writes[0],
                read,
                writes[1],
                writes[2],
                writes[3],
                read,
                writes[4],
                writes[5],
              ]);
              expect(
                Array.from(await monitor.readMemory(0x3200, 0x3205)),
                `input byte ${value}`,
              ).toEqual([
                ((255 - value) & 0x7f) ^ 0x20,
                ((255 - volatile) & 0x7f) ^ 0x20,
                ((255 - value) & 0x7f) ^ 0x20,
                ((255 - value) & 0x3f) ^ 0x12,
                ((255 - volatile) & 0x3f) ^ 0x12,
                ((255 - value) & 0x3f) ^ 0x12,
              ]);
              expect(Array.from(await monitor.readMemory(0x3300, 0x3301))).toEqual([
                value,
                volatile,
              ]);
            }
          } finally {
            for (const trace of traces) await monitor.deleteCheckpoint(trace);
          }
        });
      });
    },
    180_000,
  );

  it.each(sourceLibraryProfiles)(
    "should retain saved intermediates across uses calls and ordered reads and preserve word fallback on %s",
    async (profile) => {
      // These excluded consumers preserve behavior without acquiring any new assembly/cost demand.
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
            const first = value ^ 0xa5;
            const second = value ^ 0x80;
            const complemented = 255 - value;
            const masked = complemented & 0x7f;
            const saved = ((255 - first) & 0x7f) ^ 0x20;
            const wordResult = ((65535 - word) & 0x7fff) ^ 0x2000;
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
            await monitor.writeMemory(0x3300, Uint8Array.from([value, first, second]));
            await monitor.writeMemory(0x3304, Uint8Array.from([word & 0xff, word >>> 8]));
            await monitor.writeMemory(0x3210, Uint8Array.from(Array<number>(9).fill(0xcc)));
            const entry = await monitor.readCpuRegisters();
            const reads = [await monitor.setAccessTracepoint(0x3301, "load")];
            reads.push(await monitor.setAccessTracepoint(0x3302, "load"));
            const inputWrite = await monitor.setAccessTracepoint(0x3300, "store");
            const writes: number[] = [];
            for (let address = 0x3210; address <= 0x3218; address += 1)
              writes.push(await monitor.setAccessTracepoint(address, "store"));
            const wordWrites = [await monitor.setAccessTracepoint(0x3220, "store")];
            wordWrites.push(await monitor.setAccessTracepoint(0x3221, "store"));
            const traces = [...reads, inputWrite, ...writes, ...wordWrites];
            try {
              monitor.takeCheckpointHits();
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
              const exit = await monitor.readCpuRegisters();
              expect(exit.sp).toBe(entry.sp);
              expect(exit.p & 0x0c).toBe(entry.p & 0x0c);
              expect(monitor.takeCheckpointHits().filter((id) => traces.includes(id))).toEqual([
                writes[0],
                writes[1],
                reads[1],
                writes[5],
                reads[1],
                inputWrite,
                writes[2],
                writes[3],
                writes[4],
                reads[0],
                reads[1],
                writes[5],
                reads[1],
                writes[6],
                reads[0],
                writes[7],
                reads[1],
                writes[5],
                writes[8],
                ...wordWrites,
              ]);
              expect(Array.from(await monitor.readMemory(0x3210, 0x3218))).toEqual([
                complemented,
                masked,
                complemented,
                masked,
                masked ^ 0x20,
                second,
                ((255 - first) & 0x7f) ^ second,
                saved,
                saved,
              ]);
              expect(Array.from(await monitor.readMemory(0x3220, 0x3221))).toEqual([
                wordResult & 0xff,
                wordResult >>> 8,
              ]);
              expect(Array.from(await monitor.readMemory(0x3300, 0x3302))).toEqual([
                second,
                first,
                second,
              ]);
              expect(Array.from(await monitor.readMemory(0x3304, 0x3305))).toEqual([
                word & 0xff,
                word >>> 8,
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
