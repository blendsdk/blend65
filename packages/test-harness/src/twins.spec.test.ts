/**
 * The twin verification tier: every manifest pair's hand-written twin is
 * assembled through real ACME, loaded on real VICE, and must land the
 * IDENTICAL shared observable set its fixture suite consumes against the
 * compiled program — the equivalence contract, nothing more. Pairs with a
 * recorded measured window additionally re-measure it fresh and must match
 * the committed reference exactly.
 *
 * Each pair registers its observable table and (for frame-looping programs)
 * its twin-side loop-head label here, together with its manifest entry — a
 * manifest pair without a tier row fails loudly. Negative coverage runs
 * against a temp-flipped copy of a table, never a committed asset.
 *
 * Local tier: real ACME + VICE, sequential, skipped in CI.
 */

import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { AssertionError } from "./run/assertions.js";
import { measureCycles, quiesce } from "./run/measure.js";
import { runUntilLabelArrivals } from "./run/strategies.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import { loadBudgetFile } from "./budget-loader.js";
import { loadTwinManifest } from "./twin-manifest.js";
import { assembleTwin } from "./testing/twin-assemble.js";
import { assertObservables, type Check, type ProgramObservables } from "./testing/observables.js";
import { BALLOON_OBSERVABLES } from "./testing/balloon.js";
import { GATE_OBSERVABLES } from "./testing/gate.js";
import { GUARDS_OBSERVABLES } from "./testing/guards.js";
import { SLICE3A_OBSERVABLES } from "./testing/slice3a.js";
import { SLICE3B_OBSERVABLES } from "./testing/slice3b.js";
import { SLICE4A_OBSERVABLES } from "./testing/slice4a.js";
import { SLICE4B_OBSERVABLES } from "./testing/slice4b.js";
import { SLICE5A_OBSERVABLES } from "./testing/slice5a.js";
import { SLICE5B_OBSERVABLES } from "./testing/slice5b.js";
import { SLICE6_OBSERVABLES } from "./testing/slice6.js";
import { SLICE7_OBSERVABLES } from "./testing/slice7.js";
import { SLICE7B_OBSERVABLES } from "./testing/slice7b.js";
import { SLICE8_OBSERVABLES } from "./testing/slice8.js";
import { SLICE8B_OBSERVABLES } from "./testing/slice8b.js";
import { RASTERPOLL_OBSERVABLES } from "./testing/rasterpoll.js";

/** The repository root (this file lives at packages/test-harness/src). */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const GOLDEN_DIR = join(REPO_ROOT, "packages", "test-harness", "test", "golden");
const MANIFEST_PATH = join(GOLDEN_DIR, "twins.json");
const BUDGETS_PATH = join(GOLDEN_DIR, "budgets.json");

const LOCAL_TEST_TIMEOUT = 60000;
/** Generous guard for one measurement run (autostart + a few frames). */
const MEASURE_TIMEOUT = 60000;

/** One pair's tier registration: its shared table + twin-side loop head. */
interface PairTable {
  readonly observables: ProgramObservables;
  /** The TWIN's frame-loop-head label (frame-looping pairs only). */
  readonly twinLoopHead?: string;
  /**
   * Checks the TWIN's own source mandates but the compiled program does not,
   * run against the twin only.
   *
   * The shared table holds what BOTH sources mandate. When the two programs
   * reach the same visible result by different legitimate means, a value can
   * be fixed by one source and chosen by the allocator in the other — it does
   * not belong in the shared table, but dropping it outright would leave the
   * twin's own behaviour unasserted, and the twin is the reference the whole
   * corpus is measured against.
   */
  readonly twinExtraChecks?: readonly Check[];
}

/**
 * Per-pair registrations — one row per manifest pair, added together with
 * the pair itself. The observable set is the fixture's own table; only the
 * loop-head label differs per consumer. The label must arrive exactly ONCE
 * per frame: the balloon twin's `mainloop` aliases its raster-poll head
 * (no instruction between them), so `update` — the post-poll body entry —
 * is its once-per-frame anchor; the 2nd arrival still means exactly one
 * frame body has run.
 */
const PAIR_TABLES: Readonly<Record<string, PairTable>> = {
  gate: { observables: GATE_OBSERVABLES },
  slice3a: { observables: SLICE3A_OBSERVABLES },
  slice3b: { observables: SLICE3B_OBSERVABLES },
  slice4a: { observables: SLICE4A_OBSERVABLES },
  slice4b: { observables: SLICE4B_OBSERVABLES },
  slice5a: { observables: SLICE5A_OBSERVABLES },
  slice5b: { observables: SLICE5B_OBSERVABLES },
  slice6: { observables: SLICE6_OBSERVABLES },
  slice7: { observables: SLICE7_OBSERVABLES },
  slice7b: { observables: SLICE7B_OBSERVABLES },
  slice8: { observables: SLICE8_OBSERVABLES },
  slice8b: { observables: SLICE8B_OBSERVABLES },
  guards: { observables: GUARDS_OBSERVABLES, twinLoopHead: "update" },
  rasterpoll: { observables: RASTERPOLL_OBSERVABLES, twinLoopHead: "update" },
  balloon: {
    observables: BALLOON_OBSERVABLES,
    twinLoopHead: "update",
    // The twin stages its sprite into the tape buffer and hardcodes both the
    // block number and the destination; the compiled program aligns its image
    // and reads it where it lies, at an address the allocator picks. Same
    // sprite on screen, different means — so these are asserted per side.
    twinExtraChecks: [
      { address: 0x07f8, value: 13, note: "twin's sprite pointer: block 13 = $0340" },
      {
        address: 0x0340,
        bytesFile: "examples/balloon/balloon.bin",
        note: "twin's staged sprite image",
      },
    ],
  },
};

const manifest = loadTwinManifest(MANIFEST_PATH);

describe("Specification: twin corpus coverage", () => {
  it("pairs exactly the committed goldens plus balloon, each with a tier registration", () => {
    const goldens = readdirSync(GOLDEN_DIR)
      .filter((file) => file.endsWith(".asm.golden"))
      .map((file) => file.replace(/\.asm\.golden$/, ""));
    const corpus = [...goldens, "balloon"].sort();
    expect(Object.keys(manifest.pairs).sort()).toEqual(corpus);
    expect(Object.keys(PAIR_TABLES).sort()).toEqual(corpus);
  });
});

describe("Specification: balloon's routing prose survived the placement rewrite (ST-C20)", () => {
  // The scoreboard freshness gate rebuilds every pair from source, so it
  // catches stale numbers — but it reads none of this prose, and a routing
  // note that has become false ships looking authoritative. These are the two
  // claims that placement falsified outright and that a machine can check.
  it("carries no sourceForced flag and no copy()-gap attribution", () => {
    const routing = manifest.pairs.balloon?.routing;
    expect(routing, "balloon must carry routing entries").toBeDefined();
    const rows = Object.values(routing ?? {}).flat();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.sourceForced, `${row.disposition}: the copy is no longer source-forced`).toBe(
        undefined,
      );
      expect(
        row.note,
        `${row.disposition}: the copy() gap no longer explains anything`,
      ).not.toMatch(/copy\(\) language gap/);
    }
  });
});

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: twin tier on VICE", () => {
  for (const [name, pair] of Object.entries(manifest.pairs)) {
    it(
      `${name}: the twin lands the identical shared observable set`,
      async () => {
        const table = PAIR_TABLES[name];
        if (table === undefined) {
          throw new Error(
            `pair '${name}' has no observables registration in the twin tier — ` +
              `register its table together with its manifest entry`,
          );
        }
        const twin = assembleTwin(join(REPO_ROOT, pair.twin));
        try {
          const env = await setupEmulator({ binary: twin.prgPath, labelFile: twin.labelPath });
          try {
            const observables: ProgramObservables =
              table.twinExtraChecks === undefined
                ? table.observables
                : {
                    landmarks: table.observables.landmarks,
                    checks: [...table.observables.checks, ...table.twinExtraChecks],
                  };
            await assertObservables(env.driver, observables, {
              symbols: env.symbols,
              timeout: LOCAL_TEST_TIMEOUT,
              ...(table.twinLoopHead !== undefined ? { loopHeadLabel: table.twinLoopHead } : {}),
            });
          } finally {
            await env.driver.shutdown();
          }
        } finally {
          twin.cleanup();
        }
      },
      LOCAL_TEST_TIMEOUT,
    );
  }

  it(
    "a byte-flipped expected observable fails exactly that twin's case, naming the address",
    async () => {
      const flipped: ProgramObservables = {
        landmarks: BALLOON_OBSERVABLES.landmarks,
        checks: BALLOON_OBSERVABLES.checks.map((check) =>
          "value" in check && check.address === 0xd001 ? { ...check, value: check.value ^ 0xff } : check,
        ),
      };
      const twin = assembleTwin(join(REPO_ROOT, manifest.pairs.balloon.twin));
      try {
        const env = await setupEmulator({ binary: twin.prgPath, labelFile: twin.labelPath });
        try {
          const balloonLoopHead = PAIR_TABLES.balloon.twinLoopHead;
          const failure = assertObservables(env.driver, flipped, {
            symbols: env.symbols,
            timeout: LOCAL_TEST_TIMEOUT,
            ...(balloonLoopHead !== undefined ? { loopHeadLabel: balloonLoopHead } : {}),
          });
          await expect(failure).rejects.toBeInstanceOf(AssertionError);
          await expect(failure).rejects.toThrow(/d001/);
        } finally {
          await env.driver.shutdown();
        }
      } finally {
        twin.cleanup();
      }
    },
    LOCAL_TEST_TIMEOUT,
  );

  it(
    "balloon measured window: a fresh quiesced measurement equals the recorded reference exactly",
    async () => {
      const pair = manifest.pairs.balloon;
      if (pair.measured === undefined) {
        throw new Error("the balloon pair carries no measured reference in the manifest");
      }
      // The window name must exist in the same program's budgets entry —
      // the two committed files describe the same window.
      const budgets = loadBudgetFile(BUDGETS_PATH);
      expect(budgets.programs.balloon.windows.map((w) => w.name)).toContain(pair.measured.window);

      const twin = assembleTwin(join(REPO_ROOT, pair.twin));
      try {
        const env = await setupEmulator({ binary: twin.prgPath, labelFile: twin.labelPath });
        try {
          // Stop cleanly at the window entry's first arrival, mask
          // interrupts, then measure the next full window traversal.
          await runUntilLabelArrivals(env.driver, env.symbols, pair.measured.fromLabel, 1);
          await quiesce(env.driver);
          const cycles = await measureCycles(
            env.driver,
            env.symbols,
            pair.measured.fromLabel,
            pair.measured.toLabel,
            MEASURE_TIMEOUT,
          );
          expect(cycles).toBe(pair.measured.cycles);
        } finally {
          await env.driver.shutdown();
        }
      } finally {
        twin.cleanup();
      }
    },
    LOCAL_TEST_TIMEOUT,
  );
});
