import { describe, expect, it } from "vitest";
import {
  libraryEntry,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

/** All truth combinations include high-bit nonzero bytes, not merely canonical one inputs. */
const INPUTS = Array.from({ length: 8 }, (_, bits) => [
  (bits & 1) !== 0 ? 0x80 : 0,
  (bits & 2) !== 0 ? 0xff : 0,
  (bits & 4) !== 0 ? 1 : 0,
]);

/** Normal source covers control-only consumers and independently escaping Boolean values. */
const SOURCE = `module Game;
const A: word = $3300;
const B: word = $3301;
const C: word = $3302;
place(at: $3200) let andResult: byte;
place(at: $3201) let orResult: byte;
place(at: $3202) let andOrResult: byte;
place(at: $3203) let orAndResult: byte;
place(at: $3204) let rightOrResult: byte;
place(at: $3205) let rightAndResult: byte;
place(at: $3206) let callResult: byte;
place(at: $3207) let stored: boolean;
place(at: $3208) let returned: boolean;
place(at: $3209) let firstCopy: boolean;
place(at: $320a) let secondCopy: boolean;
place(at: $320b) let multiResult: byte;
place(at: $320c) let zeroAndResult: byte;
place(at: $320d) let zeroOrResult: byte;
function chooseAnd(): byte { if (peek(A) != 0 && peek(B) != 0) { return 1; } return 2; }
function chooseOr(): byte { if (peek(A) != 0 || peek(B) != 0) { return 1; } return 2; }
function chooseAndOr(): byte {
  if ((peek(A) != 0 && peek(B) != 0) || peek(C) != 0) { return 1; } return 2;
}
function chooseOrAnd(): byte {
  if ((peek(A) != 0 || peek(B) != 0) && peek(C) != 0) { return 1; } return 2;
}
function chooseRightOr(): byte {
  if (peek(A) != 0 && (peek(B) != 0 || peek(C) != 0)) { return 1; } return 2;
}
function chooseRightAnd(): byte {
  if (peek(A) != 0 || (peek(B) != 0 && peek(C) != 0)) { return 1; } return 2;
}
function left(): boolean { poke($3400, 1); return peek(A) != 0; }
function middle(): boolean { poke($3401, 2); return peek(B) != 0; }
function right(): boolean { poke($3402, 3); return peek(C) != 0; }
function escapeBoolean(): boolean { return peek(A) != 0 || peek(B) != 0; }
function interfere(): void { poke(A, 0); }
function chooseZeroAnd(): byte { if (peek(A) == 0 && peek(B) == 0) { return 1; } return 2; }
function chooseZeroOr(): byte { if (peek(A) == 0 || peek(B) == 0) { return 1; } return 2; }
export function step(): void {
  andResult = chooseAnd();
  orResult = chooseOr();
  andOrResult = chooseAndOr();
  orAndResult = chooseOrAnd();
  rightOrResult = chooseRightOr();
  rightAndResult = chooseRightAnd();
  if ((left() && middle()) || right()) { callResult = 1; } else { callResult = 2; }
  stored = peek(A) != 0 && peek(B) != 0;
  returned = escapeBoolean();
  zeroAndResult = chooseZeroAnd();
  zeroOrResult = chooseZeroOr();
  let saved: boolean = (peek(A) != 0 || peek(B) != 0) && peek(C) != 0;
  firstCopy = saved;
  interfere();
  secondCopy = saved;
  if (saved) { multiResult = 1; } else { multiResult = 2; }
}
export function observed(): void { }
export function main(): void { while (true) { step(); observed(); } }`;

/** Each bounded loop keeps its condition reads observable and its body/update order explicit. */
const LOOPS = [
  {
    name: "while",
    body: "while (peek(A) != 0 && peek(B) != 0) { count += 1; poke(A, 0); }",
  },
  {
    name: "do-while",
    body: "do { count += 1; if (count == 2) { poke(A, 0); } } while (peek(A) != 0 && peek(B) != 0);",
  },
  {
    name: "for",
    body: "for (; peek(A) != 0 || peek(B) != 0; poke(B, 0)) { count += 1; poke(A, 0); }",
  },
] as const;

/** A scalar global counter makes body entry and for-update effects independently visible. */
function loopSource(body: string): string {
  return `module Game;
const A: word = $3300;
const B: word = $3301;
place(at: $3200) let count: byte;
export function step(): void { count = 0; ${body} }
export function observed(): void { }
export function main(): void { while (true) { step(); observed(); } }`;
}

describe.each(sourceLibraryProfiles)("branch-only runtime semantics on %s", (profile) => {
  it("should preserve nested truth tables, bypass call effects and retain canonical escaping Booleans", async () => {
    // Trace expectations apply language short-circuit rules independently of emitted instructions.
    await withLibraryBuild(SOURCE, "module Extra;", profile, async (artifacts, built) => {
      await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
        for (const values of INPUTS) {
          await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
          await monitor.writeMemory(0x3300, Uint8Array.from(values));
          await monitor.writeMemory(0x3200, Uint8Array.from(Array<number>(14).fill(0xcc)));
          await monitor.writeMemory(0x3400, Uint8Array.from([0xcc, 0xcc, 0xcc]));
          const entry = await monitor.readCpuRegisters();
          const reads: number[] = [];
          const markers: number[] = [];
          const writes: number[] = [];
          for (let index = 0; index < 3; index += 1) {
            reads.push(await monitor.setAccessTracepoint(0x3300 + index, "load"));
            markers.push(await monitor.setAccessTracepoint(0x3400 + index, "store"));
          }
          for (let index = 0; index < 14; index += 1)
            writes.push(await monitor.setAccessTracepoint(0x3200 + index, "store"));
          const inputWrite = await monitor.setAccessTracepoint(0x3300, "store");
          const traces = [...reads, ...markers, ...writes, inputWrite];
          const events: number[] = [];
          const read = (index: number) => {
            events.push(reads[index]!);
            return values[index] !== 0;
          };
          const expected: number[] = [];
          for (const condition of [
            () => read(0) && read(1),
            () => read(0) || read(1),
            () => (read(0) && read(1)) || read(2),
            () => (read(0) || read(1)) && read(2),
            () => read(0) && (read(1) || read(2)),
            () => read(0) || (read(1) && read(2)),
          ]) {
            expected.push(condition() ? 1 : 2);
            events.push(writes[expected.length - 1]!);
          }
          const call = (index: number) => {
            events.push(markers[index]!);
            return read(index);
          };
          expected.push((call(0) && call(1)) || call(2) ? 1 : 2);
          events.push(writes[6]!);
          expected.push(read(0) && read(1) ? 1 : 0);
          events.push(writes[7]!);
          expected.push(read(0) || read(1) ? 1 : 0);
          events.push(writes[8]!);
          const zeroAnd = !read(0) && !read(1);
          events.push(writes[12]!);
          const zeroOr = !read(0) || !read(1);
          events.push(writes[13]!);
          const saved = (read(0) || read(1)) && read(2);
          expected.push(saved ? 1 : 0, saved ? 1 : 0, saved ? 1 : 2);
          events.push(writes[9]!, inputWrite, writes[10]!, writes[11]!);
          expected.push(zeroAnd ? 1 : 2, zeroOr ? 1 : 2);
          try {
            monitor.takeCheckpointHits();
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
            const exit = await monitor.readCpuRegisters();
            // Both wrapper checkpoints have one direct main call outstanding.
            expect(exit.sp).toBe(entry.sp);
            expect(exit.p & 0x0c).toBe(entry.p & 0x0c);
            expect(monitor.takeCheckpointHits().filter((id) => traces.includes(id))).toEqual(
              events,
            );
            expect(Array.from(await monitor.readMemory(0x3200, 0x320d))).toEqual(expected);
            expect(Array.from(await monitor.readMemory(0x3300, 0x3302))).toEqual([
              0,
              values[1],
              values[2],
            ]);
            expect(Array.from(await monitor.readMemory(0x3400, 0x3402))).toEqual(
              markers.map((marker, index) => (events.includes(marker) ? index + 1 : 0xcc)),
            );
          } finally {
            for (const trace of traces) await monitor.deleteCheckpoint(trace);
          }
        }
      });
    });
  }, 180_000);

  it.each(LOOPS)(
    "should preserve condition bypass and body update order in $name",
    async ({ name, body }) => {
      // Loop statements consume their conditions directly but keep all reached volatile accesses.
      await withLibraryBuild(
        loopSource(body),
        "module Extra;",
        profile,
        async (artifacts, built) => {
          await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
            for (const [a, b] of [
              [0, 0],
              [0x80, 0],
              [0, 0xff],
              [0x80, 0xff],
            ] as const) {
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
              await monitor.writeMemory(0x3300, Uint8Array.from([a, b]));
              const entry = await monitor.readCpuRegisters();
              const readA = await monitor.setAccessTracepoint(0x3300, "load");
              const readB = await monitor.setAccessTracepoint(0x3301, "load");
              const writeA = await monitor.setAccessTracepoint(0x3300, "store");
              const writeB = await monitor.setAccessTracepoint(0x3301, "store");
              const countWrite = await monitor.setAccessTracepoint(0x3200, "store");
              const traces = [readA, readB, writeA, writeB, countWrite];
              const events = [countWrite];
              let count = 0;
              if (name === "while") {
                events.push(readA, ...(a !== 0 ? [readB] : []));
                if (a !== 0 && b !== 0) {
                  count = 1;
                  events.push(countWrite, writeA, readA);
                }
              } else if (name === "do-while") {
                count = 1;
                events.push(countWrite, readA, ...(a !== 0 ? [readB] : []));
                if (a !== 0 && b !== 0) {
                  count = 2;
                  events.push(countWrite, writeA, readA);
                }
              } else {
                events.push(readA, ...(a === 0 ? [readB] : []));
                if (a !== 0 || b !== 0) {
                  count = 1;
                  events.push(countWrite, writeA, writeB, readA, readB);
                }
              }
              try {
                monitor.takeCheckpointHits();
                await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
                const exit = await monitor.readCpuRegisters();
                expect(exit.sp).toBe(entry.sp);
                expect(exit.p & 0x0c).toBe(entry.p & 0x0c);
                expect(monitor.takeCheckpointHits().filter((id) => traces.includes(id))).toEqual(
                  events,
                );
                expect(Array.from(await monitor.readMemory(0x3200, 0x3200))).toEqual([count]);
                expect(Array.from(await monitor.readMemory(0x3300, 0x3301))).toEqual([
                  events.includes(writeA) ? 0 : a,
                  events.includes(writeB) ? 0 : b,
                ]);
              } finally {
                for (const trace of traces) await monitor.deleteCheckpoint(trace);
              }
            }
          });
        },
      );
    },
    180_000,
  );
});
