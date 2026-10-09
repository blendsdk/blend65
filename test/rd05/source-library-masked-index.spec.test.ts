import { describe, expect, it } from "vitest";
import { profileRecords } from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  expectSameLibraryCost,
  libraryEntry,
  libraryGlobalAddress,
  libraryGlobalIntervals,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

const coldDeclarations = `let coldFlag: byte;
export function acquire(): byte { coldFlag = peek($DC00); return coldFlag; }`;
const rows = "[11, 23, 37, 41, 59, 61, 79, 83]";

/** Keep the source index unknown to local containment analysis. */
function game(indexType = "byte", object = "byte[8]", initializer = rows): string {
  return `module Game;
import { query } from Library;
let saved: ${object} = ${initializer};
let column: ${indexType};
function main(): void { poke($0400, byte(query(saved, column))); }`;
}

/** The unreachable acquisition's byte must disappear without adding any other resource. */
async function expectOmitted(
  source: string,
  library: string,
  control: string,
  profile: string,
): Promise<void> {
  await withLibraryBuild(source, library, profile, async (artifacts) => {
    expect(libraryGlobalIntervals(artifacts, library, "coldFlag").intervals).toEqual([]);
    expect(
      profileRecords(artifacts.debug.functions).filter(
        (entry) => entry.qualifiedName === "src/library.blend::Library.acquire",
      ),
    ).toEqual([]);
    libraryEntry(artifacts, "src/library.blend::Library.query");
    await withLibraryBuild(source, control, profile, async (reference) => {
      expectSameLibraryCost(artifacts, reference);
    });
  });
}

const contained = [
  { name: "byte mask on the right", type: "byte", index: "column & 7" },
  { name: "byte mask on the left", type: "byte", index: "7 & column" },
  { name: "word mask on the right", type: "word", index: "column & 7" },
  { name: "word mask on the left", type: "word", index: "7 & column" },
  { name: "signed byte sign-clearing mask", type: "sbyte", index: "column & 7" },
  { name: "signed word sign-clearing mask", type: "sword", index: "7 & column" },
  { name: "value-preserving byte narrowing", type: "word", index: "byte(column & 7)" },
  { name: "value-preserving word widening", type: "byte", index: "word(column & 7)" },
  { name: "value-preserving signed narrowing", type: "sword", index: "sbyte(column & 7)" },
  { name: "value-preserving signed widening", type: "sbyte", index: "sword(column & 7)" },
  { name: "zero mask", type: "word", index: "column & 0" },
  { name: "literal conversion control", type: "byte", index: "word(byte(7))" },
] as const;
const uncontained = [
  { name: "mask reaches the extent", type: "word", index: "column & 8" },
  { name: "mask exceeds the extent", type: "word", index: "column & 15" },
  { name: "possibly truncating cast", type: "word", index: "byte(column & $1FF)" },
  { name: "possibly sign-changing cast", type: "byte", index: "sbyte(column & $FF)" },
  { name: "signed mask retains the sign", type: "sword", index: "column & -1" },
  { name: "unmasked ordinal", type: "byte", index: "column" },
  { name: "unrelated addition", type: "word", index: "column + 1" },
  { name: "unrelated remainder", type: "word", index: "column % 8" },
] as const;

describe.sequential("saved-array masked ordinal containment", () => {
  for (const profile of sourceLibraryProfiles) {
    describe(profile, () => {
      // A complete ordinal range inside the array cannot observe unrelated private storage.
      it.each(contained)("should omit cold storage for $name", async ({ type, index }) => {
        const control = `module Library;
export function query(rows: const byte[8], column: ${type}): byte { return rows[${index}]; }`;
        await expectOmitted(game(type), `${control}\n${coldDeclarations}`, control, profile);
      });

      // Unchecked accesses may reach outside the object; unknown arithmetic is conservative.
      it.each(uncontained)("should retain cold storage for $name", async ({ type, index }) => {
        const library = `module Library;
${coldDeclarations}
export function query(rows: const byte[8], column: ${type}): byte { return rows[${index}]; }`;
        await withLibraryBuild(game(type), library, profile, async (artifacts) => {
          libraryGlobalAddress(artifacts, library, "coldFlag", 1);
          expectLibraryAccounting(artifacts);
        });
      });

      // Containment includes the full scaled element, packed field offset, and nested stride.
      it.each([
        {
          name: "word elements",
          object: "word[8]",
          init: rows,
          declarations: "",
          parameter: "const word[8]",
          value: "rows[column & 7]",
        },
        {
          name: "packed struct fields",
          object: "Library.Row[8]",
          init: `[${Array.from({ length: 8 }, (_, i) => `{ tag: ${i}, value: ${1000 + i} }`).join(", ")}]`,
          declarations: "export struct Row { tag: byte; value: word; }",
          parameter: "const Row[8]",
          value: "rows[column & 7].value",
        },
        {
          name: "nested row-major arrays",
          object: "word[2][8]",
          init: `[${rows}, ${rows}]`,
          declarations: "",
          parameter: "const word[2][8]",
          value: "rows[column & 1][column & 7]",
        },
      ])(
        "should omit cold storage with $name",
        async ({ object, init, declarations, parameter, value }) => {
          const control = `module Library;
${declarations}
export function query(rows: ${parameter}, column: word): word { return ${value}; }`;
          await expectOmitted(
            game("word", object, init),
            `${control}\n${coldDeclarations}`,
            control,
            profile,
          );
        },
      );

      // A runtime raw address remains volatile and may alias private storage, even after AND.
      it.each([
        { name: "allocatable RAM read", operation: "return peek(column & $7FFF);" },
        {
          name: "allocatable RAM write",
          operation: "poke(column & $7FFF, rows[0]); return rows[0];",
        },
        { name: "VIC selector", operation: "return peek($D000 | (column & $3F));" },
        {
          name: "CIA selector",
          operation: "poke($DC00 | (column & $0F), rows[0]); return rows[0];",
        },
      ])("should retain cold storage for $name", async ({ operation }) => {
        const library = `module Library;
${coldDeclarations}
export function query(rows: const byte[8], column: word): byte { ${operation} }`;
        await withLibraryBuild(game("word"), library, profile, async (artifacts) => {
          libraryGlobalAddress(artifacts, library, "coldFlag", 1);
          expectLibraryAccounting(artifacts);
        });
      });

      // Containment does not remove source-visible, initialized, placed, or observed objects.
      it.each([
        { name: "initialized", declaration: "let coldFlag: byte = 99;", use: "" },
        { name: "exported", declaration: "export let coldFlag: byte;", use: "" },
        { name: "placed", declaration: "place(at: $9000) let coldFlag: byte;", use: "" },
        { name: "live", declaration: "let coldFlag: byte;", use: "coldFlag = rows[0];" },
        {
          name: "address-taken",
          declaration: "let coldFlag: byte;",
          use: "poke(&coldFlag, rows[0]);",
        },
      ])("should retain $name data with a contained index", async ({ declaration, use }) => {
        const library = `module Library;
${declaration}
export function acquire(): byte { coldFlag = peek($DC00); return coldFlag; }
export function query(rows: const byte[8], column: byte): byte { ${use} return rows[column & 7]; }`;
        await withLibraryBuild(game(), library, profile, async (artifacts) => {
          libraryGlobalAddress(artifacts, library, "coldFlag", 1);
          expectLibraryAccounting(artifacts);
        });
      });

      // Expected lookup bytes come from the language's bit masks, not compiler-generated output.
      it("should execute every byte pattern and signed and word boundaries without acquisition MMIO", async () => {
        const wordInputs = [0, 7, 8, 255, 256, 32767, 32768, 65535];
        const signedInputs = [-32768, -129, -128, -1, 0, 7, 127, 128, 32767];
        const source = `module Game;
import { query, querySigned, queryWord, queryNarrow, raw } from Library;
let saved: byte[8] = ${rows};
let column: byte;
let wide: word;
let signed: sword;
let results: byte[4];
function ready(): void { }
function finished(): void { }
function main(): void {
  asm_sei();
  while (true) {
    ready();
    results[0] = query(saved, column);
    results[1] = querySigned(saved, signed);
    results[2] = queryWord(saved, wide);
    results[3] = queryNarrow(saved, wide);
    raw(0);
    finished();
  }
}`;
        const library = `module Library;
${coldDeclarations}
export function query(rows: const byte[8], column: byte): byte { return rows[column & 7]; }
export function querySigned(rows: const byte[8], column: sword): byte { return rows[7 & column]; }
export function queryWord(rows: const byte[8], column: word): byte { return rows[column & 7]; }
export function queryNarrow(rows: const byte[8], column: word): byte { return rows[byte(column & 7)]; }
const VIC_BORDER: word = $D020;
const CIA_TIMER_CONTROL: word = $DC0E;
export function raw(selector: word): void {
  poke($6000 | (selector & $FF), 45);
  peek($6000 | (selector & $FF));
  poke(VIC_BORDER | (selector & 1), 5);
  peek(VIC_BORDER | (selector & 1));
  poke(CIA_TIMER_CONTROL | (selector & 1), 0);
  peek(CIA_TIMER_CONTROL | (selector & 1));
}`;
        await withLibraryBuild(source, library, profile, async (artifacts, built) => {
          const output = libraryGlobalAddress(artifacts, source, "results", 4, "src/game.blend");
          const column = libraryGlobalAddress(artifacts, source, "column", 1, "src/game.blend");
          const wide = libraryGlobalAddress(artifacts, source, "wide", 2, "src/game.blend");
          const signed = libraryGlobalAddress(artifacts, source, "signed", 2, "src/game.blend");
          const values = [11, 23, 37, 41, 59, 61, 79, 83];
          const masked = (value: number) => values[value & 0xffff & 7]!;
          const inputs = [
            ...Array.from({ length: 256 }, (_, i) => ({
              byte: i,
              word: i,
              signed: i < 128 ? i : i - 256,
            })),
            ...wordInputs.map((i) => ({ byte: i & 255, word: i, signed: i })),
            ...signedInputs.map((i) => ({ byte: i & 255, word: i & 65535, signed: i })),
          ];
          expectLibraryAccounting(artifacts);
          await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.ready"));
            const reads = await monitor.setAccessTracepoint(0xdc00, "load");
            const writes = await monitor.setAccessTracepoint(0xdc00, "store");
            const ordered = new Map<number, string>();
            for (const address of [0x6000, 0xd020, 0xdc0e]) {
              for (const operation of ["load", "store"] as const) {
                ordered.set(
                  await monitor.setAccessTracepoint(address, operation),
                  `${operation}:${address}`,
                );
              }
            }
            monitor.takeCheckpointHits();
            try {
              for (const [index, input] of inputs.entries()) {
                if (index > 0) await stopAt(libraryEntry(artifacts, "src/game.blend::Game.ready"));
                await monitor.writeMemory(column, new Uint8Array([input.byte]));
                await monitor.writeMemory(
                  wide,
                  new Uint8Array([input.word & 255, (input.word & 65535) >>> 8]),
                );
                await monitor.writeMemory(
                  signed,
                  new Uint8Array([input.signed & 255, (input.signed & 65535) >>> 8]),
                );
                await stopAt(libraryEntry(artifacts, "src/game.blend::Game.finished"));
                expect(
                  [...(await monitor.readMemory(output, output + 3))],
                  JSON.stringify(input),
                ).toEqual([
                  masked(input.byte),
                  masked(input.signed),
                  masked(input.word),
                  masked(input.word),
                ]);
                const hits = monitor.takeCheckpointHits();
                expect(hits.filter((id) => id === reads || id === writes)).toEqual([]);
                expect(hits.flatMap((id) => (ordered.has(id) ? [ordered.get(id)] : []))).toEqual([
                  "store:24576",
                  "load:24576",
                  "store:53280",
                  "load:53280",
                  "store:56334",
                  "load:56334",
                ]);
              }
            } finally {
              await monitor.deleteCheckpoint(reads);
              await monitor.deleteCheckpoint(writes);
              for (const id of ordered.keys()) await monitor.deleteCheckpoint(id);
            }
          });
        });
      }, 60_000);
    });
  }
});
