import { describe, expect, it } from "vitest";
import {
  expectLibraryAccounting,
  libraryEntry,
  libraryGlobalAddress,
  libraryGlobalIntervals,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";

const library = `module Library;
export const VALUE: byte = 37;
let coldByte: byte;
export function coldRoutine(): byte { return coldByte; }`;

const consumers = [
  {
    name: "global scalar load",
    declarations: "place(at: $3000) let cells: byte[1];",
    body: "poke($d020, cells[INDEX]);",
  },
  {
    name: "global scalar store",
    declarations: "place(at: $3000) let cells: byte[1];",
    body: "cells[INDEX] = 7;",
  },
  {
    name: "global compound read and write",
    declarations: "place(at: $3000) let cells: byte[1];",
    body: "cells[INDEX] += 1;",
  },
  {
    name: "local scalar load",
    declarations: "",
    body: "let cells: byte[1] = [7]; poke($d020, cells[INDEX]);",
  },
  {
    name: "local scalar store",
    declarations: "",
    body: "let cells: byte[1] = [0]; cells[INDEX] = 7; poke($d020, cells[0]);",
  },
  {
    name: "borrowed scalar load",
    declarations: `place(at: $3000) let cells: byte[1];
function consume(data: byte[1]): byte { return data[INDEX]; }`,
    body: "poke($d020, consume(cells));",
  },
  {
    name: "borrowed scalar store",
    declarations: `place(at: $3000) let cells: byte[1];
function consume(data: byte[1]): void { data[INDEX] = 7; }`,
    body: "consume(cells);",
  },
  {
    name: "nested array scalar load",
    declarations: "place(at: $3000) let cells: byte[1][1];",
    body: "poke($d020, cells[INDEX][0]);",
  },
  {
    name: "nested array scalar store",
    declarations: "place(at: $3000) let cells: byte[1][1];",
    body: "cells[INDEX][0] = 7;",
  },
  {
    name: "indexed struct field load",
    declarations: "struct Cell { sample: byte; } place(at: $3000) let cells: Cell[1];",
    body: "poke($d020, cells[INDEX].sample);",
  },
  {
    name: "indexed struct field store",
    declarations: "struct Cell { sample: byte; } place(at: $3000) let cells: Cell[1];",
    body: "cells[INDEX].sample = 7;",
  },
  {
    name: "aggregate literal destination",
    declarations: "place(at: $3000) let cells: byte[1][2];",
    body: "cells[INDEX] = [17, 34];",
  },
  {
    name: "direct aggregate call destination",
    declarations: `place(at: $3000) let cells: byte[1][2];
function make(): byte[2] { return [17, 34]; }`,
    body: "cells[INDEX] = make();",
  },
  {
    name: "indirect aggregate call destination",
    declarations: `place(at: $3000) let cells: byte[1][2];
function make(): byte[2] { return [17, 34]; }`,
    body: "let maker: fn(): byte[2] = &make; cells[INDEX] = maker();",
  },
  {
    name: "borrowed aggregate call destination",
    declarations: `place(at: $3000) let cells: byte[1][2];
function make(): byte[2] { return [17, 34]; }
function consume(data: byte[1][2]): void { data[INDEX] = make(); }`,
    body: "consume(cells);",
  },
  {
    name: "local aggregate call destination",
    declarations: "function make(): byte[2] { return [17, 34]; }",
    body: "let cells: byte[1][2] = [[0, 0]]; cells[INDEX] = make(); poke($d020, cells[0][0]);",
  },
  {
    name: "nested struct array call destination",
    declarations: `struct Holder { samples: byte[1][2]; }
place(at: $3000) let holder: Holder;
function make(): byte[2] { return [17, 34]; }`,
    body: "holder.samples[INDEX] = make();",
  },
  {
    name: "local nested struct array store",
    declarations: "struct Holder { samples: byte[1][2]; }",
    body: "let holder: Holder = { samples: [[0, 0]] }; holder.samples[INDEX][0] = 7; poke($d020, holder.samples[0][0]);",
  },
  {
    name: "borrowed nested struct call destination",
    declarations: `struct Holder { samples: byte[1][2]; }
place(at: $3000) let holder: Holder;
function make(): byte[2] { return [17, 34]; }
function consume(data: Holder): void { data.samples[INDEX] = make(); }`,
    body: "consume(holder);",
  },
] as const;

describe.sequential.each(sourceLibraryProfiles)(
  "source-library unchecked indexed observers on %s",
  (profile) => {
    for (const consumer of consumers) {
      for (const unknown of [true, false]) {
        // A runtime ordinal may reach any physical byte; a complete constant in-bounds place may not.
        it(`should ${unknown ? "retain" : "omit"} cold data for ${unknown ? "an unknown ordinal in" : "a constant in-bounds"} ${consumer.name}`, async () => {
          const index = unknown ? "peekw($dc04)" : "0";
          const source = `module Game;
import { VALUE } from Library;
${consumer.declarations.replaceAll("INDEX", index)}
function main(): void { ${consumer.body.replaceAll("INDEX", index)} }`;
          await withLibraryBuild(source, library, profile, async (artifacts) => {
            if (unknown) libraryGlobalAddress(artifacts, library, "coldByte", 1);
            else
              expect(libraryGlobalIntervals(artifacts, library, "coldByte").intervals).toEqual([]);
            libraryEntry(artifacts, "src/game.blend::Game.main");
            expectLibraryAccounting(artifacts);
          });
        });
      }
    }
  },
);
