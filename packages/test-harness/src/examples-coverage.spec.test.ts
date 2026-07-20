/**
 * Specification: every program under `examples/` has a declared verification
 * tier, and carries exactly the artifacts that tier promises.
 *
 * A program can be added to `examples/` and verified by nothing at all — it
 * compiles only if something chooses to compile it, and nothing walks the
 * directory. Two demos reached the repository that way and were found by hand,
 * not by a failing test. `examples-coverage.json` closes that: it names every
 * example and its tier, and this suite asserts the manifest and the directory
 * agree exactly, so adding a program without choosing a tier fails.
 *
 * The tiers, and what each one promises:
 *
 * - **corpus** — the parity fixtures. A committed golden, a hand-written twin,
 *   a byte/cycle ratchet, and a scoreboard pair. Every property is pinned.
 * - **measured** — a twin, a ratchet and a scoreboard pair, but no committed
 *   golden, so instruction-level changes are visible as size and ratio moves
 *   rather than as a diff. Its twin lives beside the source rather than in the
 *   golden directory.
 * - **probe** — a targeted suite proving one specific behaviour. No golden and
 *   no twin on purpose: a synthetic program built to exercise one rule is not
 *   an idiom anyone would hand-write a twin of.
 * - **demo** — a runnable program that shows the language off. No golden, no
 *   twin, no ratchet, so it stays free to grow features without re-basing
 *   anything; its own suite asserts the hardware-visible facts instead.
 *
 * The negative obligations are as load-bearing as the positive ones. A `demo`
 * that acquires a golden has silently become a corpus fixture, and every future
 * edit to it starts costing a re-base nobody agreed to — so this suite fails on
 * that too, and the fix is to change the tier deliberately.
 *
 * Runs everywhere: reads committed files only, no compiler, no ACME, no VICE.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** The repository root (this file lives at packages/test-harness/src). */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
/** The committed ledger directory — budgets, twins, and this manifest. */
const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "golden");
/** The suites that may satisfy a tier's "has its own suite" obligation. */
const SUITE_DIR = dirname(fileURLToPath(import.meta.url));

type Tier = "corpus" | "measured" | "probe" | "demo";

interface CoverageManifest {
  readonly examples: Readonly<Record<string, Tier>>;
  /**
   * For a `probe` or `demo`, the suite in this package that verifies it. The
   * other two tiers are covered by their golden/ratchet/scoreboard artifacts.
   */
  readonly suites: Readonly<Record<string, string>>;
  /**
   * Examples whose own suite is not written yet, with the reason. An entry here
   * waives ONLY the "has its own suite" obligation — every other obligation of
   * its tier still applies. Emptying this list is the goal, not a formality.
   */
  readonly pendingSuite: Readonly<Record<string, string>>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const manifest = readJson<CoverageManifest>(join(GOLDEN_DIR, "examples-coverage.json"));
const budgets = readJson<{ programs: Record<string, unknown> }>(join(GOLDEN_DIR, "budgets.json"));
const twins = readJson<{ pairs: Record<string, { twin: string }> }>(join(GOLDEN_DIR, "twins.json"));

/** Every directory under `examples/`, sorted — the oracle the manifest answers to. */
function exampleDirs(): string[] {
  return readdirSync(join(REPO_ROOT, "examples"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

const namesOf = (tier: Tier): string[] =>
  Object.entries(manifest.examples)
    .filter(([, t]) => t === tier)
    .map(([name]) => name)
    .sort();

const hasGolden = (name: string): boolean => existsSync(join(GOLDEN_DIR, `${name}.asm.golden`));

describe("Specification: the examples coverage manifest is complete", () => {
  it("names every directory under examples/, and no directory that is absent", () => {
    const onDisk = exampleDirs();
    const declared = Object.keys(manifest.examples).sort();

    const undeclared = onDisk.filter((n) => !declared.includes(n));
    const phantom = declared.filter((n) => !onDisk.includes(n));

    expect(
      undeclared,
      `examples/ directories with no coverage tier — add each to examples-coverage.json ` +
        `and give it a suite, or say plainly why it needs none: ${undeclared.join(", ")}`,
    ).toEqual([]);
    expect(phantom, `manifest names directories that do not exist: ${phantom.join(", ")}`).toEqual(
      [],
    );
  });

  it("assigns every example a known tier", () => {
    const known: readonly Tier[] = ["corpus", "measured", "probe", "demo"];
    for (const [name, tier] of Object.entries(manifest.examples)) {
      expect(known, `${name} carries an unknown tier "${tier}"`).toContain(tier);
    }
  });

  it("waives a suite only for examples that exist and state a reason", () => {
    for (const [name, reason] of Object.entries(manifest.pendingSuite)) {
      expect(
        manifest.examples[name],
        `pendingSuite names ${name}, which is not an example`,
      ).toBeDefined();
      expect(reason.length, `pendingSuite entry for ${name} must say why`).toBeGreaterThan(10);
    }
  });
});

describe("Specification: each tier carries the artifacts it promises", () => {
  it("corpus: golden, twin, ratchet and scoreboard pair, all four", () => {
    for (const name of namesOf("corpus")) {
      expect(hasGolden(name), `${name} is corpus but has no committed golden`).toBe(true);
      expect(
        existsSync(join(GOLDEN_DIR, `${name}.twin.asm`)),
        `${name} is corpus but has no hand-written twin`,
      ).toBe(true);
      expect(budgets.programs[name], `${name} is corpus but has no budget ratchet`).toBeDefined();
      expect(twins.pairs[name], `${name} is corpus but has no scoreboard pair`).toBeDefined();
    }
  });

  it("measured: twin beside its source, ratchet and pair — and deliberately no golden", () => {
    for (const name of namesOf("measured")) {
      expect(budgets.programs[name], `${name} is measured but has no budget ratchet`).toBeDefined();
      const pair = twins.pairs[name];
      expect(pair, `${name} is measured but has no scoreboard pair`).toBeDefined();
      expect(
        pair.twin.startsWith(`examples/${name}/`),
        `${name} is measured, so its twin belongs beside its source, not in the golden directory`,
      ).toBe(true);
      expect(
        hasGolden(name),
        `${name} is measured but has a golden — it is a corpus fixture now; change the tier`,
      ).toBe(false);
    }
  });

  it("probe and demo: no golden, no twin, no ratchet, no pair", () => {
    for (const name of [...namesOf("probe"), ...namesOf("demo")]) {
      const tier = manifest.examples[name];
      expect(
        hasGolden(name),
        `${name} is ${tier} but has a golden — change the tier deliberately`,
      ).toBe(false);
      expect(
        existsSync(join(GOLDEN_DIR, `${name}.twin.asm`)),
        `${name} is ${tier} but has a twin — change the tier deliberately`,
      ).toBe(false);
      expect(
        budgets.programs[name],
        `${name} is ${tier} but carries a budget ratchet`,
      ).toBeUndefined();
      expect(twins.pairs[name], `${name} is ${tier} but carries a scoreboard pair`).toBeUndefined();
    }
  });

  /**
   * A `corpus` or `measured` example is already reached by its golden, ratchet
   * and scoreboard tiers — those artifacts cannot exist unmeasured. A `probe`
   * or `demo` has none of them, so its own suite is the ONLY thing standing
   * between it and no verification at all. That is where the obligation bites,
   * and it is named rather than inferred: scanning suite text for the example's
   * path looked equivalent and is not, because fixtures are reached through
   * inlined source constants and joined paths that never spell the directory.
   */
  it("probe and demo: each names the suite that verifies it, and that file exists", () => {
    for (const name of [...namesOf("probe"), ...namesOf("demo")]) {
      if (manifest.pendingSuite[name] !== undefined) continue;
      const suite = manifest.suites[name];
      expect(
        suite,
        `${name} has no golden, no twin and no ratchet, so its own suite is all that verifies ` +
          `it — name that suite, or record a waiver saying why it has none`,
      ).toBeDefined();
      expect(
        existsSync(join(SUITE_DIR, suite)),
        `${name} names the suite ${suite}, which does not exist`,
      ).toBe(true);
    }
  });
});
