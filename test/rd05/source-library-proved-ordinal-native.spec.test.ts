import { describe, expect, it } from "vitest";
import {
  libraryEntry,
  libraryGlobalAddress,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

/** A null ordinal means the source guard rejects the read and returns zero. */
interface SafeCase {
  readonly name: string;
  readonly body: string;
  readonly addressed: (index: number, choice: number) => number | null;
}

const SAFE: readonly SafeCase[] = [
  {
    name: "true upper bound",
    body: "if (index < 256) { return rows[index]; } return 0;",
    addressed: (i) => (i < 256 ? i : null),
  },
  {
    name: "false comparison arm",
    body: "if (index >= 256) { return 0; } else { return rows[index]; }",
    addressed: (i) => (i < 256 ? i : null),
  },
  {
    name: "early-return continuation",
    body: "if (index >= 256) { return 0; } return rows[index];",
    addressed: (i) => (i < 256 ? i : null),
  },
  {
    name: "smaller upper bound",
    body: "if (index < 128) { return rows[index]; } return 0;",
    addressed: (i) => (i < 128 ? i : null),
  },
  { name: "byte-range mask", body: "return rows[index & $ff];", addressed: (i) => i & 255 },
  {
    name: "nonwrapping constant offset",
    body: "if (index < 253) { return rows[index + 3]; } return 0;",
    addressed: (i) => (i < 253 ? i + 3 : null),
  },
  {
    name: "bound on every join path",
    body: "if (choice == 0) { if (index >= 256) { return 0; } } else { if (index >= 256) { return 0; } } return rows[index];",
    addressed: (i) => (i < 256 ? i : null),
  },
  {
    name: "different sufficient join bounds",
    body: "if (choice == 0) { if (index >= 128) { return 0; } } else { if (index >= 256) { return 0; } } return rows[index];",
    addressed: (i, c) => (i < (c === 0 ? 128 : 256) ? i : null),
  },
];

/** Wider or unstable ordinals keep ordinary address semantics without any cost promise. */
interface FallbackCase {
  readonly name: string;
  readonly body: string;
  readonly input: number;
  readonly addressed: number;
  readonly choice?: number;
  readonly mutation?: number;
  readonly declarations?: string;
  readonly signed?: boolean;
  readonly shared?: boolean;
}

const FALLBACK: readonly FallbackCase[] = [
  { name: "unknown word", body: "return rows[index];", input: 317, addressed: 317 },
  {
    name: "maximum ordinal 257",
    body: "if (index < 258) { return rows[index]; } return 0;",
    input: 257,
    addressed: 257,
  },
  {
    name: "maximum ordinal 300",
    body: "if (index < 301) { return rows[index]; } return 0;",
    input: 300,
    addressed: 300,
  },
  {
    name: "signed negative unchecked ordinal",
    body: "if (index < 256) { return rows[index]; } return 0;",
    input: 65535,
    addressed: -1,
    signed: true,
  },
  {
    name: "stale parameter bound",
    body: "if (index < 256) { index = peekw($3304); return rows[index]; } return 0;",
    input: 1,
    addressed: 300,
    mutation: 300,
  },
  {
    name: "address-exposed parameter mutation",
    body: "if (index < 256) { pokew(&index, peekw($3304)); return rows[index]; } return 0;",
    input: 1,
    addressed: 257,
    mutation: 257,
  },
  {
    name: "call mutation of parameter",
    body: "if (index < 256) { mutate(&index); return rows[index]; } return 0;",
    input: 1,
    addressed: 300,
    mutation: 300,
    declarations: "function mutate(address: word): void { pokew(address, peekw($3304)); }",
  },
  {
    name: "unbounded join arm",
    body: "if (choice == 0) { if (index >= 256) { return 0; } } return rows[index];",
    input: 300,
    addressed: 300,
    choice: 1,
  },
  {
    name: "different values at a join",
    body: "if (choice == 0) { index = 5; } else { index = peekw($3304); } return rows[index];",
    input: 1,
    addressed: 300,
    choice: 1,
    mutation: 300,
  },
  {
    name: "shared global reload after call",
    body: "if (ordinal < 256) { mutateGlobal(); return rows[ordinal]; } return 0;",
    input: 1,
    addressed: 300,
    mutation: 300,
    shared: true,
    declarations: "function mutateGlobal(): void { ordinal = peekw($3304); }",
  },
];

/** The source word is copied into query and then updated as a word outside the guarded access. */
function source(body: string, extent: number, declarations = "", signed = false): string {
  return `module Game;
place(at: $40f0) let data: byte[${extent}];
place(at: $3300) let ordinal: word;
place(at: $3302) let selector: byte;
place(at: $3200) let result: byte;
place(at: $3220) let beforeWord: word;
place(at: $3222) let afterWord: word;
${declarations}
function query(rows: const byte[${extent}], index: ${signed ? "sword" : "word"}, choice: byte): byte { ${body} }
export function step(): void {
  result = query(data, ${signed ? "sword(ordinal)" : "ordinal"}, selector);
  beforeWord = ordinal;
  ordinal += 1;
  afterWord = ordinal;
}
export function observed(): void { }
export function main(): void { while (true) { step(); observed(); } }`;
}

function byteAt(index: number): number {
  return ((index * 37 + 19) ^ ((index >>> 8) * 0xa5)) & 255;
}

describe.each(sourceLibraryProfiles)(
  "proved ordinal behavior with unchecked bounds on %s",
  (profile) => {
    it.each(SAFE)(
      "should address the declared byte and retain caller word updates for $name",
      async (testCase) => {
        const text = source(testCase.body, 300);
        await withLibraryBuild(text, "module Extra;", profile, async (artifacts, built) => {
          expect(libraryGlobalAddress(artifacts, text, "ordinal", 2, "src/game.blend")).toBe(
            0x3300,
          );
          await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
            const bytes = Uint8Array.from({ length: 300 }, (_, index) => byteAt(index));
            await monitor.writeMemory(0x40f0, bytes);
            let first = true;
            for (const input of [0, 15, 16, 127, 128, 252, 253, 255, 256, 257, 299, 65535]) {
              for (const choice of [0, 1]) {
                if (!first) await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
                first = false;
                await monitor.writeMemory(
                  0x3300,
                  Uint8Array.from([input & 255, input >>> 8, choice]),
                );
                await monitor.writeMemory(0x3200, Uint8Array.from([0xcc]));
                const addressed = testCase.addressed(input, choice);
                // A rejected guard must not read even the low-byte alias of its rejected ordinal.
                const address = 0x40f0 + (addressed ?? input & 255);
                const read = await monitor.setAccessTracepoint(address, "load");
                const write = await monitor.setAccessTracepoint(0x3200, "store");
                const traces = [read, write];
                try {
                  const entry = await monitor.readCpuRegisters();
                  monitor.takeCheckpointHits();
                  await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
                  const exit = await monitor.readCpuRegisters();
                  expect(exit.sp).toBe(entry.sp);
                  expect(exit.p & 0x0c).toBe(entry.p & 0x0c);
                  expect(monitor.takeCheckpointHits().filter((id) => traces.includes(id))).toEqual(
                    addressed === null ? [write] : [read, write],
                  );
                  expect(Array.from(await monitor.readMemory(0x3200, 0x3200))).toEqual([
                    addressed === null ? 0 : byteAt(addressed),
                  ]);
                  const updated = (input + 1) & 65535;
                  expect(Array.from(await monitor.readMemory(0x3220, 0x3223))).toEqual([
                    input & 255,
                    input >>> 8,
                    updated & 255,
                    updated >>> 8,
                  ]);
                  expect(Array.from(await monitor.readMemory(0x3300, 0x3301))).toEqual([
                    updated & 255,
                    updated >>> 8,
                  ]);
                  expect(Array.from(await monitor.readMemory(0x40f0, 0x421b))).toEqual(
                    Array.from(bytes),
                  );
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

    it.each(FALLBACK)(
      "should preserve full or changed ordinal addresses and ordered effects for $name",
      async (testCase) => {
        // Default boundsCheck=false retains the language's raw signed-address behavior; no new cost bound.
        const text = source(testCase.body, 320, testCase.declarations, testCase.signed);
        await withLibraryBuild(text, "module Extra;", profile, async (artifacts, built) => {
          expect(libraryGlobalAddress(artifacts, text, "ordinal", 2, "src/game.blend")).toBe(
            0x3300,
          );
          await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.step"));
            const bytes = Uint8Array.from({ length: 320 }, (_, index) => byteAt(index));
            await monitor.writeMemory(0x40f0, bytes);
            await monitor.writeMemory(0x40ef, Uint8Array.from([0xd7]));
            const mutation = testCase.mutation ?? 0;
            await monitor.writeMemory(
              0x3300,
              Uint8Array.from([testCase.input & 255, testCase.input >>> 8, testCase.choice ?? 0]),
            );
            await monitor.writeMemory(0x3304, Uint8Array.from([mutation & 255, mutation >>> 8]));
            const address = (0x40f0 + testCase.addressed) & 65535;
            const read = await monitor.setAccessTracepoint(address, "load");
            const lowRead = await monitor.setAccessTracepoint(0x3304, "load");
            const highRead = await monitor.setAccessTracepoint(0x3305, "load");
            const write = await monitor.setAccessTracepoint(0x3200, "store");
            const traces = [read, lowRead, highRead, write];
            try {
              const entry = await monitor.readCpuRegisters();
              monitor.takeCheckpointHits();
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
              const exit = await monitor.readCpuRegisters();
              // Both checkpoints are direct main calls at equal depth; outgoing A/X/Y are unspecified.
              expect(exit.sp).toBe(entry.sp);
              expect(exit.p & 0x0c).toBe(entry.p & 0x0c);
              expect(monitor.takeCheckpointHits().filter((id) => traces.includes(id))).toEqual(
                testCase.mutation === undefined ? [read, write] : [lowRead, highRead, read, write],
              );
              expect(Array.from(await monitor.readMemory(0x3200, 0x3200))).toEqual([
                testCase.addressed < 0 ? 0xd7 : byteAt(testCase.addressed),
              ]);
              const before = testCase.shared ? mutation : testCase.input;
              const updated = (before + 1) & 65535;
              expect(Array.from(await monitor.readMemory(0x3220, 0x3223))).toEqual([
                before & 255,
                before >>> 8,
                updated & 255,
                updated >>> 8,
              ]);
              expect(Array.from(await monitor.readMemory(0x3300, 0x3301))).toEqual([
                updated & 255,
                updated >>> 8,
              ]);
              expect(Array.from(await monitor.readMemory(0x40f0, 0x422f))).toEqual(
                Array.from(bytes),
              );
              expect(Array.from(await monitor.readMemory(0x3304, 0x3305))).toEqual([
                mutation & 255,
                mutation >>> 8,
              ]);
            } finally {
              for (const trace of traces) await monitor.deleteCheckpoint(trace);
            }
          });
        });
      },
      180_000,
    );
  },
);
