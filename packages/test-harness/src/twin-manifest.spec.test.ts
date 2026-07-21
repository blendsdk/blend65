/**
 * Specification tests for the strict twin-manifest loader.
 *
 * The manifest maps each corpus program to its hand-written twin, an
 * optional measured-window reference, and an optional routing block whose
 * keys are the five mechanical divergence categories and whose entries
 * carry a disposition (issue-backed unless `parity`). Validation is strict
 * and loud: unknown keys, missing fields, and vocabulary violations fail
 * naming the file, the JSON path, and — for vocabulary errors — WHICH
 * vocabulary was violated (mechanical category vs routing disposition).
 *
 * Negative cases run against temp copies; committed assets are never
 * mutated. Runs everywhere (pure file I/O, no ACME or VICE).
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

import { loadTwinManifest } from "./twin-manifest.js";

/** The repository root (this file lives at packages/test-harness/src). */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
/** The committed manifest — must always load clean. */
const COMMITTED_MANIFEST = join(REPO_ROOT, "packages", "test-harness", "test", "golden", "twins.json");

/** A complete, valid pair entry exercising every optional block. */
const FULL_PAIR = {
  source: "examples/balloon",
  twin: "examples/balloon/balloon.asm",
  measured: {
    window: "frameUpdate",
    fromLabel: "update",
    toLabel: "mainloop",
    cycles: 140,
  },
  routing: {
    "instruction selection": [{ disposition: "peephole", issue: 52 }],
    "data placement": [
      { disposition: "data/placement", issue: 49, sourceForced: true, note: "unrolled pokes" },
    ],
    layout: [{ disposition: "parity" }],
  },
};

describe("Specification: loadTwinManifest", () => {
  const scratchDirs: string[] = [];

  afterAll(() => {
    for (const dir of scratchDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  /** Write `manifest` as JSON into a fresh scratch dir and return its path. */
  function stage(manifest: unknown): string {
    const dir = mkdtempSync(join(tmpdir(), "b65-twin-manifest-"));
    scratchDirs.push(dir);
    const path = join(dir, "twins.json");
    writeFileSync(path, JSON.stringify(manifest, null, 2), "utf8");
    return path;
  }

  it("should load the committed manifest clean", () => {
    const manifest = loadTwinManifest(COMMITTED_MANIFEST);
    expect(Object.keys(manifest.pairs).length).toBeGreaterThan(0);
    expect(manifest.pairs.balloon?.source).toBe("examples/balloon");
    expect(manifest.pairs.balloon?.twin).toBe("examples/balloon/balloon.asm");
  });

  it("should route no divergence to the symbolic-address audit issue", () => {
    // That issue was an audit umbrella, and the rows filed under it turned out
    // to belong elsewhere: all but one were local constant-propagation gaps in
    // codegen dataflow, and the one genuine symbolic-address divergence has
    // since been fixed and its row re-authored from measurement. Stated flatly,
    // with no exception clause: an exception set nobody can enumerate is not a
    // check. The issue itself stays open for its remaining audit halves; it
    // simply no longer owns a routed row.
    const manifest = loadTwinManifest(COMMITTED_MANIFEST);
    const misrouted: string[] = [];
    for (const [name, pair] of Object.entries(manifest.pairs)) {
      for (const [category, entries] of Object.entries(pair.routing ?? {})) {
        for (const entry of entries) {
          if (entry.issue === 58) misrouted.push(`${name} / ${category}`);
        }
      }
    }
    expect(misrouted).toEqual([]);
  });

  it("should load a valid manifest with measured and routing blocks, typed", () => {
    const path = stage({ pairs: { balloon: FULL_PAIR, gate: { source: "examples/gate", twin: "packages/test-harness/test/golden/gate.twin.asm" } } });
    const manifest = loadTwinManifest(path);
    expect(manifest.pairs.balloon.measured?.cycles).toBe(140);
    expect(manifest.pairs.balloon.measured?.window).toBe("frameUpdate");
    expect(manifest.pairs.balloon.routing?.["data placement"]?.[0]?.sourceForced).toBe(true);
    expect(manifest.pairs.gate.measured).toBeUndefined();
  });

  it("should reject an unknown key inside a pair entry, naming file and JSON path", () => {
    const path = stage({ pairs: { balloon: { ...FULL_PAIR, bogus: 1 } } });
    expect(() => loadTwinManifest(path)).toThrow(/twins\.json.*pairs\.balloon.*'bogus'/s);
  });

  it("should reject a routing key outside the five mechanical categories, naming that vocabulary", () => {
    const path = stage({
      pairs: { balloon: { ...FULL_PAIR, routing: { "data placment": [{ disposition: "parity" }] } } },
    });
    expect(() => loadTwinManifest(path)).toThrow(
      /twins\.json.*pairs\.balloon\.routing.*mechanical category/s,
    );
  });

  it("should reject a disposition outside the routing vocabulary, naming that vocabulary", () => {
    const path = stage({
      pairs: { balloon: { ...FULL_PAIR, routing: { layout: [{ disposition: "peepole" }] } } },
    });
    expect(() => loadTwinManifest(path)).toThrow(
      /twins\.json.*pairs\.balloon\.routing.*routing disposition/s,
    );
  });

  it("should reject a parity entry that carries an issue", () => {
    const path = stage({
      pairs: { balloon: { ...FULL_PAIR, routing: { layout: [{ disposition: "parity", issue: 52 }] } } },
    });
    expect(() => loadTwinManifest(path)).toThrow(/twins\.json.*parity.*issue/s);
  });

  it("should reject a non-parity entry without an issue", () => {
    const path = stage({
      pairs: { balloon: { ...FULL_PAIR, routing: { layout: [{ disposition: "peephole" }] } } },
    });
    expect(() => loadTwinManifest(path)).toThrow(/twins\.json.*peephole.*issue/s);
  });

  it("should reject a malformed measured block, naming file and JSON path", () => {
    const path = stage({
      pairs: {
        balloon: {
          ...FULL_PAIR,
          measured: { window: "frameUpdate", fromLabel: "update", toLabel: "mainloop", cycles: "fast" },
        },
      },
    });
    expect(() => loadTwinManifest(path)).toThrow(/twins\.json.*measured\.cycles/s);
  });
});
