import { describe, expect, it } from "vitest";
import { cia2FunctionVariants } from "./cia2-output-fixture.js";
import {
  libraryEntry,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

/** Argument evaluation and a direct call each read once and publish a distinct effect marker. */
const ORDINARY = `module Game;
place(at: $3200) let parameterResult: byte;
place(at: $3201) let callResult: byte;
place(at: $3202) let orderedResult: byte;
function argument(): boolean {
  let value: byte = peek($3300);
  poke($3400, value);
  return value != 0;
}
export function ready(): boolean {
  let value: byte = peek($3301);
  poke($3401, value);
  return value != 0;
}
function choose(input: boolean): byte {
  if (!input) { return $11; } else { return $22; }
}
function callChoose(): byte {
  if (!ready()) { return $11; } else { return $22; }
}
function argumentMarker(): byte {
  let value: byte = peek($3302);
  poke($3405, value);
  return value;
}
function chooseOrdered(input: boolean, marker: byte): byte {
  poke($3404, marker);
  if (!input) { return $11; } else { return $22; }
}
export function step(): void {
  parameterResult = choose(argument());
  callResult = callChoose();
  orderedResult = chooseOrdered(argument(), argumentMarker());
}
export function observed(): void { }
export function main(): void { while (true) { step(); observed(); } }`;

/** Values that escape, survive another call, or cross blocks remain Boolean values. */
const FALLBACK = `module Game;
place(at: $3210) let stored: boolean;
place(at: $3211) let repeated: boolean;
place(at: $3212) let escaped: boolean;
place(at: $3213) let delayed: byte;
place(at: $3214) let joined: byte;
function ready(): boolean { return peek($3300) != 0; }
function negate(input: boolean): boolean { return !input; }
function interfere(): void { poke($3402, peek($3301)); }
export function step(): void {
  let negated: boolean = !ready();
  stored = negated;
  interfere();
  repeated = negated;
  escaped = negate(ready());
  let delayedValue: boolean = ready();
  interfere();
  if (!delayedValue) { delayed = $11; } else { delayed = $22; }
  let joinedValue: boolean = ready();
  if (peek($3301) != 0) { poke($3403, $77); }
  if (!joinedValue) { joined = $11; } else { joined = $22; }
}
export function observed(): void { }
export function main(): void { while (true) { step(); observed(); } }`;

/** The caller stays unchanged; a reserved RAM slot supplies a deliberately adversarial ABI callee. */
const ADVERSARIAL = `module Game;
place(at: $3800) let stubSpace: byte[16];
place(at: $3200) let result: byte;
export function ready(): boolean {
  let value: byte = peek($3300);
  poke($3401, value);
  return value != 0;
}
function callChoose(): byte {
  if (!ready()) { return $11; } else { return $22; }
}
export function step(): void { result = callChoose(); }
export function observed(): void { }
export function main(): void { while (true) { step(); observed(); } }`;

describe("branch-only Boolean negation behavior", () => {
  it.each(sourceLibraryProfiles)(
    "should execute unmodified parameter and call paths with one ordered evaluation on %s",
    async (profile) => {
      await withLibraryBuild(ORDINARY, "module Extra;", profile, async (artifacts, built) => {
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          for (const [first, second] of [
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
            [0x80, 0xff],
            [0xff, 0],
          ]) {
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
            const argumentByte = first! ^ 0x55;
            await monitor.writeMemory(0x3300, Uint8Array.from([first!, second!, argumentByte]));
            const readFirst = await monitor.setAccessTracepoint(0x3300, "load");
            const markFirst = await monitor.setAccessTracepoint(0x3400, "store");
            const writeFirst = await monitor.setAccessTracepoint(0x3200, "store");
            const readSecond = await monitor.setAccessTracepoint(0x3301, "load");
            const markSecond = await monitor.setAccessTracepoint(0x3401, "store");
            const writeSecond = await monitor.setAccessTracepoint(0x3201, "store");
            const readArgument = await monitor.setAccessTracepoint(0x3302, "load");
            const argumentMark = await monitor.setAccessTracepoint(0x3405, "store");
            const calleeMark = await monitor.setAccessTracepoint(0x3404, "store");
            const writeOrdered = await monitor.setAccessTracepoint(0x3202, "store");
            const traces = [
              readFirst,
              markFirst,
              writeFirst,
              readSecond,
              markSecond,
              writeSecond,
              readArgument,
              argumentMark,
              calleeMark,
              writeOrdered,
            ];
            try {
              const entry = await monitor.readCpuRegisters();
              monitor.takeCheckpointHits();
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
              const exit = await monitor.readCpuRegisters();
              expect(exit.sp).toBe(entry.sp);
              expect(exit.p & 0x0c).toBe(entry.p & 0x0c);
              expect(monitor.takeCheckpointHits().filter((id) => traces.includes(id))).toEqual([
                readFirst,
                markFirst,
                writeFirst,
                readSecond,
                markSecond,
                writeSecond,
                readFirst,
                markFirst,
                readArgument,
                argumentMark,
                calleeMark,
                writeOrdered,
              ]);
              expect(Array.from(await monitor.readMemory(0x3200, 0x3202))).toEqual([
                first === 0 ? 0x11 : 0x22,
                second === 0 ? 0x11 : 0x22,
                first === 0 ? 0x11 : 0x22,
              ]);
              expect(Array.from(await monitor.readMemory(0x3400, 0x3401))).toEqual([first, second]);
              expect(Array.from(await monitor.readMemory(0x3404, 0x3405))).toEqual([
                argumentByte,
                argumentByte,
              ]);
              expect(Array.from(await monitor.readMemory(0x3300, 0x3302))).toEqual([
                first,
                second,
                argumentByte,
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
    "should retain materialized multiuse escaping and intervening-effect values on %s",
    async (profile) => {
      await withLibraryBuild(FALLBACK, "module Extra;", profile, async (artifacts, built) => {
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          for (const [value, other] of [
            [0, 0],
            [0, 0xff],
            [1, 0],
            [1, 0xff],
          ]) {
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
            await monitor.writeMemory(0x3300, Uint8Array.from([value!, other!]));
            const read = await monitor.setAccessTracepoint(0x3300, "load");
            const otherRead = await monitor.setAccessTracepoint(0x3301, "load");
            const interfere = await monitor.setAccessTracepoint(0x3402, "store");
            const joinEffect = await monitor.setAccessTracepoint(0x3403, "store");
            const writes: number[] = [];
            for (let address = 0x3210; address <= 0x3214; address += 1)
              writes.push(await monitor.setAccessTracepoint(address, "store"));
            const traces = [read, otherRead, interfere, joinEffect, ...writes];
            try {
              const entry = await monitor.readCpuRegisters();
              monitor.takeCheckpointHits();
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
              const exit = await monitor.readCpuRegisters();
              expect(exit.sp).toBe(entry.sp);
              expect(exit.p & 0x0c).toBe(entry.p & 0x0c);
              expect(monitor.takeCheckpointHits().filter((id) => traces.includes(id))).toEqual([
                read,
                writes[0],
                otherRead,
                interfere,
                writes[1],
                read,
                writes[2],
                read,
                otherRead,
                interfere,
                writes[3],
                read,
                otherRead,
                ...(other === 0 ? [] : [joinEffect]),
                writes[4],
              ]);
              const negated = value === 0 ? 1 : 0;
              expect(Array.from(await monitor.readMemory(0x3210, 0x3214))).toEqual([
                negated,
                negated,
                negated,
                value === 0 ? 0x11 : 0x22,
                value === 0 ? 0x11 : 0x22,
              ]);
              expect(Array.from(await monitor.readMemory(0x3300, 0x3301))).toEqual([value, other]);
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
    "should test returned A rather than stale Z at an adversarial RAM-injected ABI boundary on %s",
    async (profile) => {
      await withLibraryBuild(ADVERSARIAL, "module Extra;", profile, async (artifacts, built) => {
        const callees = cia2FunctionVariants(artifacts, "ready");
        expect(callees).toHaveLength(1);
        // Only a three-byte entry JMP is replaced; the independent nine-byte stub owns reserved RAM.
        expect(callees[0]!.end - callees[0]!.start).toBeGreaterThanOrEqual(3);
        const callee = libraryEntry(artifacts, "src/game.blend::Game.ready");
        expect(callee).toBe(callees[0]!.start);
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          for (const value of [0, 1]) {
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
            await monitor.writeMemory(0x3300, Uint8Array.from([value]));
            // LDA $3300; STA $3401; CMP #1; RTS: A is exact, Z deliberately disagrees with A==0.
            await monitor.writeMemory(
              0x3800,
              Uint8Array.from([0xad, 0x00, 0x33, 0x8d, 0x01, 0x34, 0xc9, 0x01, 0x60]),
            );
            await monitor.writeMemory(callee, Uint8Array.from([0x4c, 0x00, 0x38]));
            const read = await monitor.setAccessTracepoint(0x3300, "load");
            const marker = await monitor.setAccessTracepoint(0x3401, "store");
            const write = await monitor.setAccessTracepoint(0x3200, "store");
            const traces = [read, marker, write];
            try {
              const entry = await monitor.readCpuRegisters();
              monitor.takeCheckpointHits();
              await stopAt(callee);
              const inside = await monitor.readCpuRegisters();
              // JSR stores the last operand address; RTS resumes one byte beyond that address.
              const low = (
                await monitor.readMemory(
                  0x100 + ((inside.sp + 1) & 255),
                  0x100 + ((inside.sp + 1) & 255),
                )
              )[0]!;
              const high = (
                await monitor.readMemory(
                  0x100 + ((inside.sp + 2) & 255),
                  0x100 + ((inside.sp + 2) & 255),
                )
              )[0]!;
              const returnedPc = ((high << 8) + low + 1) & 65535;
              await stopAt(returnedPc);
              const returned = await monitor.readCpuRegisters();
              expect(returned.a).toBe(value);
              expect(Boolean(returned.p & 2)).toBe(value !== 0);
              expect(returned.p & 0x0c).toBe(entry.p & 0x0c);
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
              const exit = await monitor.readCpuRegisters();
              // step/observed are equal-depth calls; no outgoing A/X/Y promise is imposed.
              expect(exit.sp).toBe(entry.sp);
              expect(exit.p & 0x0c).toBe(entry.p & 0x0c);
              expect(monitor.takeCheckpointHits().filter((id) => traces.includes(id))).toEqual(
                traces,
              );
              expect(Array.from(await monitor.readMemory(0x3200, 0x3200))).toEqual([
                value === 0 ? 0x11 : 0x22,
              ]);
              expect(Array.from(await monitor.readMemory(0x3401, 0x3401))).toEqual([value]);
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
