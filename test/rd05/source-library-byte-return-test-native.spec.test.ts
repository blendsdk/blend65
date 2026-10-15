import { describe, expect, it } from "vitest";
import { cia2FunctionVariants } from "./cia2-output-fixture.js";
import {
  libraryEntry,
  libraryGlobalAddress,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

const VALUES = [0, 1, 0x7f, 0x80, 0xff] as const;

/** Ordinary unmodified generated code returns the source Boolean byte through the scalar ABI. */
const ORDINARY = `module Game;
place(at: $3300) let input: boolean;
place(at: $3200) let result: byte;
place(at: $3401) let marker: byte;
export function ready(): boolean { return input; }
export function choose(): byte {
  if (!ready()) { return $11; } else { return $22; }
}
export function step(): void {
  poke(&marker, $55);
  result = choose();
  poke(&marker, $aa);
}
export function observed(): void { }
export function main(): void { while (true) { step(); observed(); } }`;

/** Only a callee trampoline is injected; the source caller and its constant-byte arms are unchanged. */
const ADVERSARIAL = `module Game;
place(at: $3300) let input: boolean;
place(at: $3200) let result: byte;
place(at: $3401) let marker: byte;
place(at: $3800) let stubSpace: byte[16];
export function ready(): boolean { poke(&marker, $5a); return input; }
export function choose(): byte {
  if (!ready()) { return $11; } else { return $22; }
}
export function step(): void { result = choose(); }
export function observed(): void { }
export function main(): void { while (true) { step(); observed(); } }`;

/** These nonconstant, wider, materialized and delayed consumers acquire no tighter output bound. */
const FALLBACK = `module Game;
place(at: $3300) let input: boolean;
place(at: $3302) let first: byte;
place(at: $3303) let second: byte;
place(at: $3210) let stored: boolean;
place(at: $3211) let reused: boolean;
place(at: $3212) let nonconstant: byte;
place(at: $3214) let wider: word;
place(at: $3216) let delayed: byte;
place(at: $3402) let marker: byte;
function ready(): boolean { return peek(&input) != 0; }
function materialize(): boolean { return !ready(); }
function interfere(): void { poke(&marker, peek($3302)); }
function chooseVariable(): byte {
  if (!ready()) { return peek(&first); } else { return peek(&second); }
}
function chooseWord(): word {
  if (!ready()) { return $117f; } else { return $2280; }
}
export function step(): void {
  let negated: boolean = materialize();
  stored = negated;
  interfere();
  reused = negated;
  nonconstant = chooseVariable();
  wider = chooseWord();
  let saved: boolean = ready();
  interfere();
  if (peek($3303) != 0) { poke(&marker, $77); }
  if (!saved) { delayed = peek(&first); } else { delayed = peek(&second); }
}
export function observed(): void { }
export function main(): void { while (true) { step(); observed(); } }`;

describe("byte-return Boolean tests", () => {
  it.each(sourceLibraryProfiles)(
    "should execute untouched generated calls for every selected Boolean representation on %s",
    async (profile) => {
      await withLibraryBuild(ORDINARY, "module Extra;", profile, async (artifacts, built) => {
        expect(libraryGlobalAddress(artifacts, ORDINARY, "input", 1, "src/game.blend")).toBe(
          0x3300,
        );
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          for (const value of VALUES) {
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
            await monitor.writeMemory(0x3300, Uint8Array.from([value]));
            const read = await monitor.setAccessTracepoint(0x3300, "load");
            const write = await monitor.setAccessTracepoint(0x3200, "store");
            const marker = await monitor.setAccessTracepoint(0x3401, "store");
            const inputWrite = await monitor.setAccessTracepoint(0x3300, "store");
            const traces = [read, write, marker, inputWrite];
            try {
              const entry = await monitor.readCpuRegisters();
              monitor.takeCheckpointHits();
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
              const exit = await monitor.readCpuRegisters();
              expect(exit.sp).toBe(entry.sp);
              expect(exit.p & 0x0c).toBe(entry.p & 0x0c);
              expect(monitor.takeCheckpointHits().filter((id) => traces.includes(id))).toEqual([
                marker,
                read,
                write,
                marker,
              ]);
              expect(Array.from(await monitor.readMemory(0x3200, 0x3200))).toEqual([
                value === 0 ? 0x11 : 0x22,
              ]);
              expect(Array.from(await monitor.readMemory(0x3401, 0x3401))).toEqual([0xaa]);
              expect(Array.from(await monitor.readMemory(0x3300, 0x3300))).toEqual([value]);
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
    "should establish fresh zero truth from arbitrary A despite opposite Z at a RAM-injected ABI boundary on %s",
    async (profile) => {
      await withLibraryBuild(ADVERSARIAL, "module Extra;", profile, async (artifacts, built) => {
        const callees = cia2FunctionVariants(artifacts, "ready");
        expect(callees).toHaveLength(1);
        expect(callees[0]!.end - callees[0]!.start).toBeGreaterThanOrEqual(3);
        const callee = libraryEntry(artifacts, "src/game.blend::Game.ready");
        expect(callee).toBe(callees[0]!.start);
        expect(
          libraryGlobalAddress(artifacts, ADVERSARIAL, "stubSpace", 16, "src/game.blend"),
        ).toBe(0x3800);
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          for (const value of VALUES) {
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
            await monitor.writeMemory(0x3300, Uint8Array.from([value]));
            // LDA #$5a; STA $3401; LDA $3300; CMP #different/equal; RTS.
            // This independent official stub preserves marker/read effects, A, I/D and stack balance.
            const compare = value === 0 ? 1 : value;
            await monitor.writeMemory(
              0x3800,
              Uint8Array.from([
                0xa9,
                0x5a,
                0x8d,
                0x01,
                0x34,
                0xad,
                0x00,
                0x33,
                0xc9,
                compare,
                0x60,
              ]),
            );
            await monitor.writeMemory(callee, Uint8Array.from([0x4c, 0x00, 0x38]));
            const marker = await monitor.setAccessTracepoint(0x3401, "store");
            const read = await monitor.setAccessTracepoint(0x3300, "load");
            const write = await monitor.setAccessTracepoint(0x3200, "store");
            const inputWrite = await monitor.setAccessTracepoint(0x3300, "store");
            const traces = [marker, read, write, inputWrite];
            try {
              const entry = await monitor.readCpuRegisters();
              monitor.takeCheckpointHits();
              await stopAt(callee);
              const inside = await monitor.readCpuRegisters();
              const lowAddress = 0x100 + ((inside.sp + 1) & 255);
              const highAddress = 0x100 + ((inside.sp + 2) & 255);
              const low = (await monitor.readMemory(lowAddress, lowAddress))[0]!;
              const high = (await monitor.readMemory(highAddress, highAddress))[0]!;
              // JSR pushes its last operand address; RTS resumes one byte after that address.
              await stopAt(((high << 8) + low + 1) & 65535);
              const returned = await monitor.readCpuRegisters();
              expect(returned.a).toBe(value);
              expect(Boolean(returned.p & 2)).toBe(value !== 0);
              expect(returned.sp).toBe((inside.sp + 2) & 255);
              expect(returned.p & 0x0c).toBe(entry.p & 0x0c);
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
              const exit = await monitor.readCpuRegisters();
              // Equal-depth wrapper endpoints impose no general outgoing A/X/Y or arithmetic-flag promise.
              expect(exit.sp).toBe(entry.sp);
              expect(exit.p & 0x0c).toBe(entry.p & 0x0c);
              expect(monitor.takeCheckpointHits().filter((id) => traces.includes(id))).toEqual([
                marker,
                read,
                write,
              ]);
              expect(Array.from(await monitor.readMemory(0x3200, 0x3200))).toEqual([
                value === 0 ? 0x11 : 0x22,
              ]);
              expect(Array.from(await monitor.readMemory(0x3401, 0x3401))).toEqual([0x5a]);
              expect(Array.from(await monitor.readMemory(0x3300, 0x3300))).toEqual([value]);
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
    "should preserve materialized delayed nonconstant and word continuations without tighter cost demands on %s",
    async (profile) => {
      await withLibraryBuild(FALLBACK, "module Extra;", profile, async (artifacts, built) => {
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          for (const value of VALUES) {
            for (const second of [0, 0x80]) {
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
              const first = 0x7f;
              await monitor.writeMemory(0x3300, Uint8Array.from([value]));
              await monitor.writeMemory(0x3302, Uint8Array.from([first, second]));
              const read = await monitor.setAccessTracepoint(0x3300, "load");
              const firstRead = await monitor.setAccessTracepoint(0x3302, "load");
              const secondRead = await monitor.setAccessTracepoint(0x3303, "load");
              const marker = await monitor.setAccessTracepoint(0x3402, "store");
              const writes: number[] = [];
              for (const address of [0x3210, 0x3211, 0x3212, 0x3216])
                writes.push(await monitor.setAccessTracepoint(address, "store"));
              const traces = [read, firstRead, secondRead, marker, ...writes];
              try {
                const entry = await monitor.readCpuRegisters();
                monitor.takeCheckpointHits();
                await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
                const exit = await monitor.readCpuRegisters();
                expect(exit.sp).toBe(entry.sp);
                expect(exit.p & 0x0c).toBe(entry.p & 0x0c);
                const events = monitor.takeCheckpointHits().filter((id) => traces.includes(id));
                expect(events).toEqual([
                  read,
                  writes[0],
                  firstRead,
                  marker,
                  writes[1],
                  read,
                  ...(value === 0 ? [firstRead] : [secondRead]),
                  writes[2],
                  read,
                  read,
                  firstRead,
                  marker,
                  secondRead,
                  ...(second === 0 ? [] : [marker]),
                  ...(value === 0 ? [firstRead] : [secondRead]),
                  writes[3],
                ]);
                const negated = value === 0 ? 1 : 0;
                const selected = value === 0 ? first : second;
                expect(Array.from(await monitor.readMemory(0x3210, 0x3212))).toEqual([
                  negated,
                  negated,
                  selected,
                ]);
                const wider = value === 0 ? 0x117f : 0x2280;
                expect(Array.from(await monitor.readMemory(0x3214, 0x3216))).toEqual([
                  wider & 255,
                  wider >>> 8,
                  selected,
                ]);
                expect(Array.from(await monitor.readMemory(0x3300, 0x3300))).toEqual([value]);
              } finally {
                for (const trace of traces) await monitor.deleteCheckpoint(trace);
              }
            }
          }
        });
      });
    },
    180_000,
  );
});
