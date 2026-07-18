/**
 * Implementation tests for the twin-manifest loader internals: exact
 * error-message shapes (file + JSON path prefixes) and the deep-frozen
 * return structure. The specification tier pins the validation matrix;
 * these pin the loader's mechanics.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { loadTwinManifest } from "./twin-manifest.js";

/** A minimal valid pair body. */
const PAIR = { source: "examples/balloon", twin: "examples/balloon/balloon.asm" };

describe("Implementation: loadTwinManifest internals", () => {
  const scratchDirs: string[] = [];

  afterAll(() => {
    for (const dir of scratchDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  /** Write `manifest` as JSON under `name` in a fresh scratch dir. */
  function stage(manifest: unknown, name = "twins.json"): string {
    const dir = mkdtempSync(join(tmpdir(), "b65-twin-manifest-impl-"));
    scratchDirs.push(dir);
    const path = join(dir, name);
    writeFileSync(path, JSON.stringify(manifest), "utf8");
    return path;
  }

  it("should return a deep-frozen structure at every level", () => {
    const path = stage({
      pairs: {
        balloon: {
          ...PAIR,
          measured: { window: "frameUpdate", fromLabel: "update", toLabel: "mainloop", cycles: 97 },
          routing: { layout: [{ disposition: "parity" }] },
        },
      },
    });
    const manifest = loadTwinManifest(path);
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.pairs)).toBe(true);
    expect(Object.isFrozen(manifest.pairs.balloon)).toBe(true);
    expect(Object.isFrozen(manifest.pairs.balloon.measured)).toBe(true);
    expect(Object.isFrozen(manifest.pairs.balloon.routing)).toBe(true);
    expect(Object.isFrozen(manifest.pairs.balloon.routing?.layout)).toBe(true);
    expect(Object.isFrozen(manifest.pairs.balloon.routing?.layout?.[0])).toBe(true);
  });

  it("should shape errors as '<file>: <path> <message>'", () => {
    expect(() => loadTwinManifest(stage({ pairs: { balloon: { ...PAIR, source: "" } } }))).toThrow(
      "twins.json: pairs.balloon.source must be a non-empty string",
    );
    expect(() => loadTwinManifest(stage({ pairs: [], extra: 1 }))).toThrow(
      "twins.json: $ has unknown key 'extra'",
    );
    expect(() =>
      loadTwinManifest(
        stage({
          pairs: {
            balloon: {
              ...PAIR,
              measured: { window: "w", fromLabel: "a", toLabel: "b", cycles: -1 },
            },
          },
        }),
      ),
    ).toThrow("twins.json: pairs.balloon.measured.cycles must be a non-negative integer");
    expect(() =>
      loadTwinManifest(
        stage({
          pairs: {
            balloon: { ...PAIR, routing: { layout: [{ disposition: "peephole", issue: 0 }] } },
          },
        }),
      ),
    ).toThrow("twins.json: pairs.balloon.routing.layout[0].issue must be a positive integer");
    expect(() =>
      loadTwinManifest(stage({ pairs: { balloon: { ...PAIR, routing: { layout: {} } } } })),
    ).toThrow("twins.json: pairs.balloon.routing.layout must be an array of routing entries");
  });

  it("should prefix errors with the actual file basename", () => {
    const path = stage({ pairs: 1 }, "custom.json");
    expect(() => loadTwinManifest(path)).toThrow(/^custom\.json: pairs must be an object/);
  });
});
