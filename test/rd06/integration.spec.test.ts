import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { withProject } from "./project-fixture.js";

const fixtures = join(process.cwd(), "test/rd06/fixtures/public");

describe("RD-06 cross-format integration", () => {
  // One program consumes raw, Koala and PSID data plus a compile-time scalar.
  it("should reconcile assets, memory, costs and debug sidecars", async () => {
    const source = `module Game;
place(at: $2000) const BITMAP: byte[] = embed("level.kla", "bitmap");
place(at: $0C00) const SCREEN: byte[] = embed("level.kla", "screen");
const MUSIC: byte[] = embed("music.sid");
const MUSIC_INIT: word = embed("music.sid", "init_address");
const TABLE: byte[] = embed("table.bin");
function main(): void {
  poke($0400, TABLE[0]);
  poke($0401, MUSIC[0]);
  poke($0402, byte(MUSIC_INIT));
  poke($D018, c64.vic.vicBitmapSelect(&BITMAP) | c64.vic.vicScreenSelect(&SCREEN));
}
`;
    await withProject(
      source,
      [
        {
          path: "level.kla",
          bytes: readFileSync(join(fixtures, "koala/koala-patterned.kla")),
        },
        {
          path: "music.sid",
          bytes: readFileSync(join(fixtures, "psid/psid-v1-fixed.sid")),
        },
        { path: "table.bin", bytes: Uint8Array.from([9, 8, 7, 6]) },
      ],
      async (project) => {
        const built = await buildProject({ project });
        expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
          "success",
        );
        if (built.kind !== "success") throw new Error("Expected the integration build");
        const directory = built.generation.directory;
        const assets = JSON.parse(await readFile(join(directory, ".assets.json"), "utf8")) as {
          assets: {
            handler: string;
            selector: string;
            placement: { kind: string; range?: { visibility: string[]; start: number } };
          }[];
        };
        expect(assets.assets).toHaveLength(5);
        expect(
          assets.assets.map(({ handler, selector, placement }) => [
            handler,
            selector,
            placement.kind,
          ]),
        ).toEqual(
          expect.arrayContaining([
            ["koala", "bitmap", "single"],
            ["koala", "screen", "single"],
            ["psid", "data", "single"],
            ["psid", "init_address", "compileTime"],
            ["raw", "raw", "single"],
          ]),
        );
        const bitmap = assets.assets.find(({ selector }) => selector === "bitmap")!;
        expect(bitmap.placement.range).toMatchObject({
          start: 0x2000,
          visibility: ["vic"],
        });
        const memory = JSON.parse(await readFile(join(directory, ".memory.json"), "utf8")) as {
          views: { id: string; occupiedBytes: number; freeBytes: number; capacityBytes: number }[];
        };
        expect(memory.views.map(({ id }) => id)).toEqual([
          "color-ram",
          "cpu16-resident",
          "vic-bank-0",
        ]);
        for (const view of memory.views) {
          expect(view.occupiedBytes + view.freeBytes).toBe(view.capacityBytes);
        }
        const costs = JSON.parse(await readFile(join(directory, ".costs.json"), "utf8")) as {
          entries: { kind: string; bytes: number; component: string; owner: { kind: string } }[];
        };
        expect(
          costs.entries.some(
            (entry) =>
              entry.kind === "bytes" &&
              entry.bytes === 0 &&
              entry.component === "initializedData" &&
              entry.owner.kind === "symbol",
          ),
        ).toBe(true);
        const debug = JSON.parse(await readFile(join(directory, ".debug.json"), "utf8")) as {
          symbols: { kind: string; labels: string[] }[];
          locations: { symbolIndex: number; availability: { kind: string } }[];
        };
        const scalarIndex = debug.symbols.findIndex(
          ({ kind, labels }) => kind === "asset" && labels.length === 0,
        );
        expect(scalarIndex).toBeGreaterThanOrEqual(0);
        expect(
          debug.locations.find(({ symbolIndex }) => symbolIndex === scalarIndex)?.availability.kind,
        ).toBe("optimizedAway");
      },
    );
  }, 60_000);

  // A zero-byte selected array is a compile-time object. It must not emit
  // resident bytes, but its debug symbol and zero-byte cost must reconcile.
  it("should publish a zero-byte selected array without resident storage", async () => {
    const source = `module Game;
const EMPTY: byte[] = embed("empty.spd");
function main(): void {}
`;
    const emptySpd = Uint8Array.from([
      0x53, 0x50, 0x44, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    await withProject(source, [{ path: "empty.spd", bytes: emptySpd }], async (project) => {
      const built = await buildProject({ project });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expected the empty asset build");
      const directory = built.generation.directory;
      const assets = JSON.parse(await readFile(join(directory, ".assets.json"), "utf8")) as {
        assets: {
          placement: { kind: string };
          payloadBytes: number;
          emittedBytes: number;
          logicalType: string;
          shape: number[];
        }[];
      };
      expect(assets.assets).toHaveLength(1);
      expect(assets.assets[0]).toMatchObject({
        placement: { kind: "compileTime" },
        payloadBytes: 0,
        emittedBytes: 0,
        logicalType: "const byte[]",
        shape: [0],
      });
      const costs = JSON.parse(await readFile(join(directory, ".costs.json"), "utf8")) as {
        entries: { kind: string; bytes: number; owner: { kind: string } }[];
      };
      expect(
        costs.entries.some(
          (entry) => entry.kind === "bytes" && entry.bytes === 0 && entry.owner.kind === "symbol",
        ),
      ).toBe(true);
      const debug = JSON.parse(await readFile(join(directory, ".debug.json"), "utf8")) as {
        symbols: { kind: string; type: string; shape: number[]; labels: string[] }[];
        locations: { symbolIndex: number; availability: { kind: string } }[];
      };
      const index = debug.symbols.findIndex(({ kind }) => kind === "asset");
      expect(index).toBeGreaterThanOrEqual(0);
      expect(debug.symbols[index]).toMatchObject({ type: "byte[0]", shape: [0], labels: [] });
      expect(
        debug.locations.find(({ symbolIndex }) => symbolIndex === index)?.availability.kind,
      ).toBe("optimizedAway");
      const memory = JSON.parse(await readFile(join(directory, ".memory.json"), "utf8")) as {
        intervals: { kind: string; payloadBytes: number }[];
      };
      expect(memory.intervals.some(({ kind }) => kind === "asset")).toBe(false);
    });
  }, 60_000);

  // Mixed scalar constants and embedded values inside a const aggregate must
  // encode, not silently become BSS.
  it("should encode mixed and inline embedded const aggregates", async () => {
    const source = `module Game;
const A: byte[2] = [1, 2];
const N: byte = 9;
const T: byte[2][2] = [A, [N, 4]];
const E: byte[1][4] = [embed("row.bin")];
function main(): void { poke($0400, T[0][0]); poke($0401, E[0][0]); }
`;
    await withProject(
      source,
      [{ path: "row.bin", bytes: Uint8Array.from([0x11, 0x22, 0x33, 0x44]) }],
      async (project) => {
        const built = await buildProject({ project });
        expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
          "success",
        );
        if (built.kind !== "success") throw new Error("Expected mixed aggregate build");
        const memory = JSON.parse(
          await readFile(join(built.generation.directory, ".memory.json"), "utf8"),
        ) as { intervals: { id: string; start: number; end: number; kind: string }[] };
        const globals = memory.intervals.filter(({ kind }) => kind === "initializedData");
        // A (2 bytes), T (4 bytes) and E (4 bytes) are initialized.
        expect(globals).toHaveLength(3);
        const prg = await readFile(
          join(built.generation.directory, built.generation.primaryArtifact),
        );
        const bytesAt = (interval: { start: number; end: number }): number[] => {
          const offset = interval.start - 0x0801 + 2;
          return [...prg.subarray(offset, offset + (interval.end - interval.start))];
        };
        expect(globals.map(bytesAt)).toEqual(
          expect.arrayContaining([
            [1, 2, 9, 4],
            [0x11, 0x22, 0x33, 0x44],
          ]),
        );
      },
    );
  }, 60_000);

  // Named and embedded aggregates must become initialized const data, and an
  // asset address must materialize as the address, not as the first bytes.
  it("should initialize const aggregates and materialize asset addresses", async () => {
    const source = `module Game;
const ROW: byte[4] = embed("row.bin");
const TABLE: byte[1][4] = [ROW];
const ALIAS: byte[4] = ROW;
function main(): void { poke($0400, TABLE[0][0]); poke($0401, ALIAS[0]); poke($0402, peek(&ROW)); }
`;
    await withProject(
      source,
      [{ path: "row.bin", bytes: Uint8Array.from([0x11, 0x22, 0x33, 0x44]) }],
      async (project) => {
        const built = await buildProject({ project });
        expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
          "success",
        );
        if (built.kind !== "success") throw new Error("Expected the aggregate build");
        const memory = JSON.parse(
          await readFile(join(built.generation.directory, ".memory.json"), "utf8"),
        ) as { intervals: { id: string; start: number; end: number; kind: string }[] };
        const globals = memory.intervals.filter(({ kind }) => kind === "initializedData");
        expect(globals).toHaveLength(2);
        for (const global of globals) expect(global.end - global.start).toBe(4);
        const asm = await readFile(join(built.generation.directory, ".asm"), "utf8");
        expect(asm).toMatch(/lda #<\(b65_assets_row_bin_/u);
        expect(asm).toMatch(/lda #>\(b65_assets_row_bin_/u);
        const prg = await readFile(
          join(built.generation.directory, built.generation.primaryArtifact),
        );
        for (const global of globals) {
          const offset = global.start - 0x0801 + 2;
          expect([...prg.subarray(offset, offset + 4)]).toEqual([0x11, 0x22, 0x33, 0x44]);
        }
      },
    );
  }, 60_000);
});
