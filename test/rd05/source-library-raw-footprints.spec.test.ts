import { describe, expect, it } from "vitest";
import {
  expectLibraryAccounting,
  libraryBytes,
  libraryEntry,
  libraryFunctionBytes,
  libraryGlobalAddress,
  libraryGlobalIntervals,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

const library = `module Library;
export const VALUE: byte = 37;
let coldByte: byte;
export function coldRoutine(): byte { return coldByte; }`;

/** Keep the selected source module present without adding a raw RAM observer. */
function program(body: string, declarations = "") {
  return `module Game;
import { VALUE } from Library;
${declarations}
function main(): void { ${body} }`;
}

describe.sequential.each(sourceLibraryProfiles)(
  "source-library raw access footprints on %s",
  (profile) => {
    for (const { name, declarations, operation } of [
      {
        name: "loaded word",
        declarations: "let pointer: word = $d020;",
        operation: "peek(pointer);",
      },
      {
        name: "ordinary call result",
        declarations: "function address(): word { return $d020; }",
        operation: "peek(address());",
      },
      { name: "runtime arithmetic", declarations: "", operation: "peek(peekw($dc04) + $d020);" },
      {
        name: "conditional merge",
        declarations: "",
        operation: "peek(peek($dc00) == 0 ? $d020 : $d021);",
      },
      { name: "RAM byte read", declarations: "", operation: "peek($c100);" },
      { name: "RAM byte write", declarations: "", operation: "poke($c100, 7);" },
      { name: "zero-page word read", declarations: "", operation: "peekw($0080);" },
      { name: "zero-page word write", declarations: "", operation: "pokew($0080, $1234);" },
    ]) {
      // Unproved or overlapping raw footprints conservatively keep every cold candidate.
      it(`should retain cold private data for a reached ${name}`, async () => {
        await withLibraryBuild(
          program(operation, declarations),
          library,
          profile,
          async (artifacts) => {
            libraryGlobalAddress(artifacts, library, "coldByte", 1);
            expectLibraryAccounting(artifacts);
          },
        );
      });
    }

    // A safe run-time address remains unknown to closure even when the fixture knows its loaded bits.
    it("should preserve byte write then read through a loaded unknown word address", async () => {
      const source = program(
        "asm_php(); asm_sei(); poke(pointer, 7); peek(pointer); done(); asm_plp();",
        "let pointer: word = $d020; function done(): void { asm_nop(); }",
      );
      await withLibraryBuild(source, library, profile, async (artifacts, built) => {
        libraryGlobalAddress(artifacts, library, "coldByte", 1);
        const main = libraryEntry(artifacts, "src/game.blend::Game.main");
        expect(libraryBytes(artifacts, main, 2)).toEqual([0x08, 0x78]);
        expectLibraryAccounting(artifacts);
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          await stopAt(main + 2);
          const store = await monitor.setAccessTracepoint(0xd020, "store");
          const load = await monitor.setAccessTracepoint(0xd020, "load");
          monitor.takeCheckpointHits();
          await stopAt(libraryEntry(artifacts, "src/game.blend::Game.done"));
          expect(monitor.takeCheckpointHits().filter((id) => id === store || id === load)).toEqual([
            store,
            load,
          ]);
          const pins = (await monitor.readIo(0xd020, 0xd020))[0]!;
          expect((await monitor.readCpuRegisters()).a).toBe(pins);
          expect(pins & 15).toBe(7);
          await monitor.deleteCheckpoint(store);
          await monitor.deleteCheckpoint(load);
          await stopAt(libraryStartup(artifacts, "startup.restore"));
        });
      });
    }, 180_000);

    for (const converted of [false, true]) {
      for (const word of [false, true]) {
        const address = converted ? "word($d020)" : "$d020";
        const operation = word
          ? `pokew(${address}, $0706); peekw(${address});`
          : `poke(${address}, 7); peek(${address});`;
        // Literal and literal-conversion device footprints do not observe ordinary RAM or selected ZP.
        it(`should omit cold private data for ${converted ? "converted" : "literal"} disjoint ${word ? "word" : "byte"} MMIO`, async () => {
          const source = program(
            `asm_php(); asm_sei(); ${operation} done(); asm_plp();`,
            "function done(): void { asm_nop(); }",
          );
          await withLibraryBuild(source, library, profile, async (artifacts, built) => {
            expect(libraryGlobalIntervals(artifacts, library, "coldByte").intervals).toEqual([]);
            const main = libraryEntry(artifacts, "src/game.blend::Game.main");
            const expected = word
              ? [
                  0xa9, 6, 0x8d, 0x20, 0xd0, 0xa9, 7, 0x8d, 0x21, 0xd0, 0xad, 0x20, 0xd0, 0xae,
                  0x21, 0xd0,
                ]
              : [0xa9, 7, 0x8d, 0x20, 0xd0, 0xad, 0x20, 0xd0];
            expect(libraryBytes(artifacts, main + 2, expected.length)).toEqual(expected);
            const done = libraryEntry(artifacts, "src/game.blend::Game.done");
            const restore = libraryStartup(artifacts, "startup.restore");
            expect(libraryFunctionBytes(artifacts, "src/game.blend::Game.main")).toEqual([
              0x08,
              0x78,
              ...expected,
              0x20,
              done & 0xff,
              done >>> 8,
              0x28,
              0x4c,
              restore & 0xff,
              restore >>> 8,
            ]);
            expectLibraryAccounting(artifacts);
            await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
              await stopAt(main + 2);
              const lowStore = await monitor.setAccessTracepoint(0xd020, "store");
              const highStore = await monitor.setAccessTracepoint(0xd021, "store");
              const lowLoad = await monitor.setAccessTracepoint(0xd020, "load");
              const highLoad = await monitor.setAccessTracepoint(0xd021, "load");
              const checkpoints = [lowStore, highStore, lowLoad, highLoad];
              monitor.takeCheckpointHits();
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.done"));
              expect(monitor.takeCheckpointHits().filter((id) => checkpoints.includes(id))).toEqual(
                word ? [lowStore, highStore, lowLoad, highLoad] : [lowStore, lowLoad],
              );
              const registers = await monitor.readCpuRegisters();
              const pins = [...(await monitor.readIo(0xd020, word ? 0xd021 : 0xd020))];
              expect(registers.a).toBe(pins[0]);
              if (word) expect(registers.x).toBe(pins[1]);
              expect(pins.map((value) => value & 15)).toEqual(word ? [6, 7] : [7]);
              for (const checkpoint of checkpoints) await monitor.deleteCheckpoint(checkpoint);
              await stopAt(libraryStartup(artifacts, "startup.restore"));
            });
          });
        }, 180_000);
      }
    }

    for (const { address, word, keep, read, write } of [
      {
        address: "$ffff",
        word: true,
        keep: false,
        read: [0xad, 0xff, 0xff, 0xa6, 0x00],
        write: [0xa9, 0x34, 0x8d, 0xff, 0xff, 0xa9, 0x12, 0x85, 0x00],
      },
      {
        address: "$0001",
        word: true,
        keep: true,
        read: [0xa5, 0x01, 0xa6, 0x02],
        write: [0xa9, 0x34, 0x85, 0x01, 0xa9, 0x12, 0x85, 0x02],
      },
      {
        address: "$0800",
        word: true,
        keep: true,
        read: [0xad, 0x00, 0x08, 0xae, 0x01, 0x08],
        write: [0xa9, 0x34, 0x8d, 0x00, 0x08, 0xa9, 0x12, 0x8d, 0x01, 0x08],
      },
      {
        address: "$cfff",
        word: true,
        keep: true,
        read: [0xad, 0xff, 0xcf, 0xae, 0x00, 0xd0],
        write: [0xa9, 0x34, 0x8d, 0xff, 0xcf, 0xa9, 0x12, 0x8d, 0x00, 0xd0],
      },
      {
        address: "$0800",
        word: false,
        keep: false,
        read: [0xad, 0x00, 0x08],
        write: [0xa9, 7, 0x8d, 0x00, 0x08],
      },
      {
        address: "$d000",
        word: false,
        keep: false,
        read: [0xad, 0x00, 0xd0],
        write: [0xa9, 7, 0x8d, 0x00, 0xd0],
      },
    ]) {
      for (const store of [false, true]) {
        const operation = store
          ? `${word ? "pokew" : "poke"}(${address}, ${word ? "$1234" : "7"});`
          : `${word ? "peekw" : "peek"}(${address});`;
        const bytes = store ? write : read;
        // The complete byte footprint wraps modulo 65536 and may cross either candidate window boundary.
        it(`should ${keep ? "retain" : "omit"} cold data for the complete ${word ? "word" : "byte"} ${store ? "write" : "read"} at ${address}`, async () => {
          await withLibraryBuild(program(operation), library, profile, async (artifacts) => {
            if (keep) libraryGlobalAddress(artifacts, library, "coldByte", 1);
            else
              expect(libraryGlobalIntervals(artifacts, library, "coldByte").intervals).toEqual([]);
            const main = libraryEntry(artifacts, "src/game.blend::Game.main");
            expect(libraryBytes(artifacts, main, bytes.length)).toEqual(bytes);
            const restore = libraryStartup(artifacts, "startup.restore");
            expect(libraryFunctionBytes(artifacts, "src/game.blend::Game.main")).toEqual([
              ...bytes,
              0x4c,
              restore & 0xff,
              restore >>> 8,
            ]);
            expectLibraryAccounting(artifacts);
          });
        });
      }
    }
  },
);
