import { describe, expect, it } from "vitest";
import {
  expectLibraryAccounting,
  libraryEntry,
  libraryGlobalAddress,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

const values = [11, 23, 37, 41, 59, 61, 79, 83];
const placedAddress = 0x9008;
const physicalStart = 0x9000;
const physicalBytes = [101, 103, 107, 109, 113, 127, 131, 137, ...values];
const wordInputs = [0, 7, 8, 63, 64, 127, 128, 199, 200, 255, 256, 511, 512, 65535];
const byteInputs = wordInputs.filter((value) => value <= 255);

const cases = [
  {
    name: "a guarded low-byte conversion before unsigned shift by three",
    type: "word",
    width: 2,
    limit: 64,
    shift: 3,
    signed: false,
    inputs: wordInputs,
    body: "if (column >= 64) { return 0; } return rows[byte(column) >> 3];",
  },
  {
    name: "a guarded truncating conversion before unsigned shift by six",
    type: "word",
    width: 2,
    limit: 512,
    shift: 6,
    signed: false,
    inputs: wordInputs,
    body: "if (column < 512) { return rows[byte(column) >> 6]; } return 0;",
  },
  {
    name: "a guarded signed reinterpretation before arithmetic shift by five",
    type: "byte",
    width: 1,
    limit: 200,
    shift: 5,
    signed: true,
    inputs: byteInputs,
    body: "if (column < 200) { return rows[sbyte(column) >> 5]; } return 0;",
  },
] as const;

describe.sequential.each(sourceLibraryProfiles)(
  "source-library direct cast ordinal execution on %s",
  (profile) => {
    it.each(cases)(
      "should preserve source-order cast and shift behavior for $name",
      async (testCase) => {
        const source = `module Game;
import { query } from Library;
place(at: $9008) let saved: byte[8] = [11, 23, 37, 41, 59, 61, 79, 83];
let column: ${testCase.type};
let answer: byte;
function ready(): void { }
function finished(): void { }
function main(): void {
  asm_sei();
  while (true) {
    ready();
    answer = query(saved, column);
    finished();
  }
}`;
        const library = `module Library;
let coldFlag: byte;
export function acquire(): byte { coldFlag = peek($DC00); return coldFlag; }
export function query(rows: const byte[8], column: ${testCase.type}): byte { ${testCase.body} }`;
        await withLibraryBuild(source, library, profile, async (artifacts, built) => {
          const saved = libraryGlobalAddress(artifacts, source, "saved", 8, "src/game.blend");
          const column = libraryGlobalAddress(
            artifacts,
            source,
            "column",
            testCase.width,
            "src/game.blend",
          );
          const answer = libraryGlobalAddress(artifacts, source, "answer", 1, "src/game.blend");
          expect(saved).toBe(placedAddress);
          expectLibraryAccounting(artifacts);
          const ready = libraryEntry(artifacts, "src/game.blend::Game.ready");
          const finished = libraryEntry(artifacts, "src/game.blend::Game.finished");
          await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
            await stopAt(ready);
            expect([...(await monitor.readMemory(saved, saved + 7))]).toEqual(values);
            await monitor.writeMemory(physicalStart, Uint8Array.from(physicalBytes));
            expect([
              ...(await monitor.readMemory(
                physicalStart,
                physicalStart + physicalBytes.length - 1,
              )),
            ]).toEqual(physicalBytes);
            for (const [iteration, input] of testCase.inputs.entries()) {
              if (iteration > 0) await stopAt(ready);
              const encoded =
                testCase.width === 1
                  ? Uint8Array.of(input)
                  : Uint8Array.of(input % 256, Math.floor(input / 256));
              await monitor.writeMemory(column, encoded);
              await monitor.writeMemory(answer, Uint8Array.of(0xee));
              expect([...(await monitor.readMemory(column, column + testCase.width - 1))]).toEqual([
                ...encoded,
              ]);

              // The explicit cast happens before ordinal widening and the subsequent shift.
              const lowByte = input % 256;
              const castValue = testCase.signed && lowByte >= 128 ? lowByte - 256 : lowByte;
              const ordinal = Math.floor(castValue / 2 ** testCase.shift);
              const expected =
                input < testCase.limit
                  ? physicalBytes[placedAddress - physicalStart + ordinal]!
                  : 0;
              await stopAt(finished);
              expect([...(await monitor.readMemory(answer, answer))], `input ${input}`).toEqual([
                expected,
              ]);
              expect([...(await monitor.readMemory(column, column + testCase.width - 1))]).toEqual([
                ...encoded,
              ]);
              expect([
                ...(await monitor.readMemory(
                  physicalStart,
                  physicalStart + physicalBytes.length - 1,
                )),
              ]).toEqual(physicalBytes);
            }
          });
        });
      },
      180_000,
    );
  },
);
