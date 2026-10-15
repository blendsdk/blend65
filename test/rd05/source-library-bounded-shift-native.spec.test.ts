import { describe, expect, it } from "vitest";
import {
  libraryEntry,
  libraryGlobalAddress,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

/** Each signed byte is supplied as its raw two's-complement representation. */
const OPERATIONS = [
  { name: "leftByte", type: "byte", operator: "<<", input: "unsignedValue", kind: "left" },
  { name: "rightByte", type: "byte", operator: ">>", input: "unsignedValue", kind: "logical" },
  { name: "leftSigned", type: "sbyte", operator: "<<", input: "signedValue", kind: "left" },
  { name: "rightSigned", type: "sbyte", operator: ">>", input: "signedValue", kind: "arithmetic" },
] as const;
const MODES = ["maskedByte", "maskedWord", "guardedByte", "guardedWord", "convertedWord"] as const;

/** Independent repeated arithmetic avoids JavaScript's implicit wide-count masking. */
function shifted(value: number, count: number, kind: string): number {
  if (count >= 8) return kind === "arithmetic" && value >= 128 ? 255 : 0;
  let result = kind === "arithmetic" && value >= 128 ? value - 256 : value;
  for (let step = 0; step < count; step += 1) {
    if (kind === "left") result = (result * 2) % 256;
    else result = Math.floor(result / 2);
  }
  return (result + 256) % 256;
}

/** Normal copied arguments exercise byte and word counts without changing the source count homes. */
function boundedSource(): string {
  const declarations: string[] = [];
  const functions: string[] = [];
  const stores: string[] = [];
  for (const [modeIndex, mode] of MODES.entries()) {
    const word = mode !== "maskedByte" && mode !== "guardedByte";
    const count = word ? "wideCount" : "narrowCount";
    for (const [operationIndex, operation] of OPERATIONS.entries()) {
      const name = `${mode}${operation.name}`;
      declarations.push(
        `place(at: $${(0x3200 + modeIndex * 4 + operationIndex).toString(16)}) let ${name}Result: ${operation.type};`,
      );
      const rhs = mode.startsWith("guarded")
        ? "count"
        : mode === "convertedWord"
          ? "byte(count & 7)"
          : "(count & 7)";
      const expression = `value ${operation.operator} ${rhs}`;
      const body = mode.startsWith("guarded")
        ? `if (count < 8) { return ${expression}; } return $55;`
        : `return ${expression};`;
      functions.push(
        `function ${name}(value: ${operation.type}, count: ${word ? "word" : "byte"}): ${operation.type} { ${body} }`,
      );
      stores.push(`${name}Result = ${name}(${operation.input}, ${count});`);
    }
  }
  return `module Game;
place(at: $3300) let unsignedInput: byte;
place(at: $3301) let signedInput: sbyte;
place(at: $3302) let byteCount: byte;
place(at: $3304) let wordCount: word;
${declarations.join("\n")}
${functions.join("\n")}
export function step(): void {
  let unsignedValue: byte = peek(&unsignedInput);
  let signedValue: sbyte = sbyte(peek(&signedInput));
  let narrowCount: byte = peek(&byteCount);
  let wideCount: word = peekw(&wordCount);
  poke($3400, $5a);
  ${stores.join("\n  ")}
}
export function observed(): void { }
export function main(): void { while (true) { step(); observed(); } }`;
}

/** Unknown counts and later shared reloads retain saturation; a pre-effect local snapshot remains bounded. */
const FALLBACK = `module Game;
place(at: $3300) let unsignedInput: byte;
place(at: $3301) let signedInput: sbyte;
place(at: $3302) let byteCount: byte;
place(at: $3304) let wordCount: word;
place(at: $3306) let sharedCount: word;
place(at: $3308) let replacement: word;
place(at: $3220) let unknownLeft: byte;
place(at: $3221) let unknownRight: byte;
place(at: $3222) let unknownSigned: sbyte;
place(at: $3223) let wideLeft: byte;
place(at: $3224) let wideRight: byte;
place(at: $3225) let wideSigned: sbyte;
place(at: $3226) let reloaded: byte;
place(at: $3227) let captured: byte;
function unknown(value: byte, count: byte): byte { return value << count; }
function logical(value: byte, count: byte): byte { return value >> count; }
function arithmetic(value: sbyte, count: byte): sbyte { return value >> count; }
function wide(value: byte, count: word): byte { return value << count; }
function wideLogical(value: byte, count: word): byte { return value >> count; }
function wideArithmetic(value: sbyte, count: word): sbyte { return value >> count; }
function mutate(): void { sharedCount = peekw(&replacement); poke($3401, $77); }
export function step(): void {
  let unsignedValue: byte = peek(&unsignedInput);
  let signedValue: sbyte = sbyte(peek(&signedInput));
  let narrowCount: byte = peek(&byteCount);
  let wideCount: word = peekw(&wordCount);
  unknownLeft = unknown(unsignedValue, narrowCount);
  unknownRight = logical(unsignedValue, narrowCount);
  unknownSigned = arithmetic(signedValue, narrowCount);
  wideLeft = wide(unsignedValue, wideCount);
  wideRight = wideLogical(unsignedValue, wideCount);
  wideSigned = wideArithmetic(signedValue, wideCount);
  if (sharedCount < 8) {
    let saved: word = sharedCount;
    mutate();
    reloaded = unsignedValue >> sharedCount;
    captured = unsignedValue >> saved;
  } else { reloaded = $55; captured = $55; }
}
export function observed(): void { }
export function main(): void { while (true) { step(); observed(); } }`;

describe("ordinary mainline bounded shift behavior", () => {
  it.each(sourceLibraryProfiles)(
    "should preserve masked converted and guarded byte-result semantics with ordered source reads on %s",
    async (profile) => {
      const text = boundedSource();
      await withLibraryBuild(text, "module Extra;", profile, async (artifacts, built) => {
        expect(libraryGlobalAddress(artifacts, text, "byteCount", 1, "src/game.blend")).toBe(
          0x3302,
        );
        expect(libraryGlobalAddress(artifacts, text, "wordCount", 2, "src/game.blend")).toBe(
          0x3304,
        );
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          for (const value of [0, 1, 0x7f, 0x80, 0xff]) {
            for (const rawCount of [0, 1, 7, 8, 255, 256, 65535]) {
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
              const narrow = rawCount % 256;
              await monitor.writeMemory(0x3300, Uint8Array.from([value, value, narrow]));
              await monitor.writeMemory(
                0x3304,
                Uint8Array.from([rawCount % 256, Math.floor(rawCount / 256)]),
              );
              const reads: number[] = [];
              for (const address of [0x3300, 0x3301, 0x3302, 0x3304, 0x3305])
                reads.push(await monitor.setAccessTracepoint(address, "load"));
              const marker = await monitor.setAccessTracepoint(0x3400, "store");
              const writes: number[] = [];
              for (let address = 0x3200; address <= 0x3213; address += 1)
                writes.push(await monitor.setAccessTracepoint(address, "store"));
              const traces = [...reads, marker, ...writes];
              try {
                const entry = await monitor.readCpuRegisters();
                monitor.takeCheckpointHits();
                await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
                const exit = await monitor.readCpuRegisters();
                expect(exit.sp).toBe(entry.sp);
                expect(exit.p & 0x0c).toBe(entry.p & 0x0c);
                expect(monitor.takeCheckpointHits().filter((id) => traces.includes(id))).toEqual(
                  traces,
                );
                const expected = MODES.flatMap((mode) => {
                  const count = mode === "maskedByte" || mode === "guardedByte" ? narrow : rawCount;
                  return OPERATIONS.map((operation) =>
                    mode.startsWith("guarded") && count >= 8
                      ? 0x55
                      : shifted(
                          value,
                          mode.startsWith("guarded") ? count : count % 8,
                          operation.kind,
                        ),
                  );
                });
                expect(Array.from(await monitor.readMemory(0x3200, 0x3213))).toEqual(expected);
                expect(Array.from(await monitor.readMemory(0x3300, 0x3302))).toEqual([
                  value,
                  value,
                  narrow,
                ]);
                expect(Array.from(await monitor.readMemory(0x3304, 0x3305))).toEqual([
                  rawCount % 256,
                  Math.floor(rawCount / 256),
                ]);
                expect(Array.from(await monitor.readMemory(0x3400, 0x3400))).toEqual([0x5a]);
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

  it.each(sourceLibraryProfiles)(
    "should saturate unknown counts and invalidate a shared reload without invalidating its local capture on %s",
    async (profile) => {
      await withLibraryBuild(FALLBACK, "module Extra;", profile, async (artifacts, built) => {
        expect(libraryGlobalAddress(artifacts, FALLBACK, "wordCount", 2, "src/game.blend")).toBe(
          0x3304,
        );
        expect(libraryGlobalAddress(artifacts, FALLBACK, "sharedCount", 2, "src/game.blend")).toBe(
          0x3306,
        );
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          for (const value of [0, 1, 0x7f, 0x80, 0xff]) {
            for (const rawCount of [0, 1, 7, 8, 255, 256, 65535]) {
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
              const narrow = rawCount % 256;
              const saved = 7;
              await monitor.writeMemory(0x3300, Uint8Array.from([value, value, narrow]));
              await monitor.writeMemory(
                0x3304,
                Uint8Array.from([
                  rawCount % 256,
                  Math.floor(rawCount / 256),
                  saved,
                  0,
                  rawCount % 256,
                  Math.floor(rawCount / 256),
                ]),
              );
              const reads: number[] = [];
              for (const address of [0x3300, 0x3301, 0x3302, 0x3304, 0x3305, 0x3308, 0x3309])
                reads.push(await monitor.setAccessTracepoint(address, "load"));
              const marker = await monitor.setAccessTracepoint(0x3401, "store");
              const writes: number[] = [];
              for (let address = 0x3220; address <= 0x3227; address += 1)
                writes.push(await monitor.setAccessTracepoint(address, "store"));
              const traces = [...reads, marker, ...writes];
              try {
                const entry = await monitor.readCpuRegisters();
                monitor.takeCheckpointHits();
                await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
                const exit = await monitor.readCpuRegisters();
                expect(exit.sp).toBe(entry.sp);
                expect(exit.p & 0x0c).toBe(entry.p & 0x0c);
                expect(monitor.takeCheckpointHits().filter((id) => traces.includes(id))).toEqual([
                  ...reads.slice(0, 5),
                  ...writes.slice(0, 6),
                  ...reads.slice(5),
                  marker,
                  ...writes.slice(6),
                ]);
                expect(Array.from(await monitor.readMemory(0x3220, 0x3227))).toEqual([
                  shifted(value, narrow, "left"),
                  shifted(value, narrow, "logical"),
                  shifted(value, narrow, "arithmetic"),
                  shifted(value, rawCount, "left"),
                  shifted(value, rawCount, "logical"),
                  shifted(value, rawCount, "arithmetic"),
                  shifted(value, rawCount, "logical"),
                  shifted(value, saved, "logical"),
                ]);
                expect(Array.from(await monitor.readMemory(0x3300, 0x3302))).toEqual([
                  value,
                  value,
                  narrow,
                ]);
                expect(Array.from(await monitor.readMemory(0x3304, 0x3309))).toEqual([
                  rawCount % 256,
                  Math.floor(rawCount / 256),
                  rawCount % 256,
                  Math.floor(rawCount / 256),
                  rawCount % 256,
                  Math.floor(rawCount / 256),
                ]);
                expect(Array.from(await monitor.readMemory(0x3401, 0x3401))).toEqual([0x77]);
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
