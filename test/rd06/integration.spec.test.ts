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
});
