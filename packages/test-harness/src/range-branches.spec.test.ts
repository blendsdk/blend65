/**
 * Specification tests for conditional branches beyond the 6502 relative
 * reach (−128..+127 bytes): a program whose control flow spans that distance
 * must still assemble under real ACME. Two probes exercise both directions —
 * a `do…while` whose fat body stretches the backward loop branch, and a
 * `switch` whose dispatch branches forward across two fat case bodies.
 *
 * The negative is the load-bearing test: an implementation may not buy
 * assemblability by wrapping EVERY conditional branch in the long-form
 * branch-over-jump — in-range branches must survive as plain short branches,
 * exactly as a hand-written assembly program would keep them.
 *
 * Three suites, each gated on exactly what it needs: the assemble tier on
 * ACME (which CI installs), the shape tier on nothing at all — it reads
 * emitted text — and the execution tier on ACME plus VICE, which CI has no
 * emulator for.
 */

import { afterAll, describe, expect, it } from "vitest";
import {
  buildDoWhileRange,
  buildSwitchRange,
  DO_WHILE_RANGE_OBSERVABLES,
  emitAsmDoWhileRange,
  emitAsmSwitchRange,
  SWITCH_RANGE_OBSERVABLES,
  type BuiltRangeFixture,
} from "./testing/range-branches.js";
import {
  branchOverJumps,
  fallThroughJumps,
  parseFunctionSections,
  scanCoverage,
  trampolineBlocks,
} from "./testing/golden-scan.js";
import { emitAsmRasterpoll } from "./testing/rasterpoll.js";
import { assertObservables, type ProgramObservables } from "./testing/observables.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import type { EmulatorDriver } from "./emulator/driver.js";

const LOCAL_TEST_TIMEOUT = 120000;

/** The 6502 conditional-branch mnemonics (the relative-only opcodes). */
const CONDITIONAL_BRANCH = /^(bcc|bcs|beq|bne|bmi|bpl|bvc|bvs)$/i;

/** What a program's emitted branches look like, in aggregate. */
interface BranchShape {
  /** Total conditional-branch instructions in the text. */
  readonly conditionals: number;
  /** How many of them sit in a branch-over-jump trigram (see below). */
  readonly branchOverJump: number;
}

/**
 * Counts conditional branches and the branch-over-jump trigram: a
 * conditional branch, then an unconditional `JMP`, then the branch's own
 * target label defined on the next line — i.e. the branch merely hops over
 * the `JMP` that does the real travelling. Blank and comment-only lines are
 * ignored, since they cannot change the assembled instruction stream.
 */
function branchShapeOf(asm: string): BranchShape {
  const lines = asm
    .split("\n")
    .map((line) => line.replace(/;.*$/, "").trim())
    .filter((line) => line.length > 0);

  let conditionals = 0;
  let branchOverJump = 0;
  for (let i = 0; i < lines.length; i++) {
    const tokens = lines[i]!.split(/\s+/);
    if (tokens.length < 2 || !CONDITIONAL_BRANCH.test(tokens[0]!)) {
      continue;
    }
    conditionals += 1;
    const target = tokens[1]!;
    const next = lines[i + 1] ?? "";
    const after = lines[i + 2] ?? "";
    const afterLabel = after.split(/\s+/)[0]?.replace(/:$/, "") ?? "";
    if (/^jmp\s+/i.test(next) && afterLabel === target) {
      branchOverJump += 1;
    }
  }
  return { conditionals, branchOverJump };
}

/** The ACME-failure diagnostics (with messages, so a red run shows why). */
function assemblerFailures(built: BuiltRangeFixture): string[] {
  return built.result.diagnostics
    .filter((d) => d.code === "E90001")
    .map((d) => `${d.code}: ${d.message}`);
}

describe.skipIf(!hasAcme())("Specification: long-range branches assemble (ST-B36..ST-B37)", () => {
  let builtDoWhile: BuiltRangeFixture | undefined;
  let builtSwitch: BuiltRangeFixture | undefined;

  afterAll(() => {
    builtDoWhile?.cleanup();
    builtSwitch?.cleanup();
  });

  it(
    "ST-B36: a do…while whose back-edge branch exceeds the relative reach assembles under ACME",
    async () => {
      builtDoWhile = await buildDoWhileRange();
      // The assembler must accept the emitted branches — no internal
      // assembler-failure diagnostic, no error of any kind, a real binary.
      expect(assemblerFailures(builtDoWhile)).toEqual([]);
      expect(builtDoWhile.result.hasErrors).toBe(false);
      expect(builtDoWhile.result.diagnostics).toEqual([]);
      expect(builtDoWhile.result.binary).toBeInstanceOf(Uint8Array);
    },
    LOCAL_TEST_TIMEOUT,
  );

  it(
    "ST-B37: a switch whose dispatch branches forward past the relative reach assembles under ACME",
    async () => {
      builtSwitch = await buildSwitchRange();
      expect(assemblerFailures(builtSwitch)).toEqual([]);
      expect(builtSwitch.result.hasErrors).toBe(false);
      expect(builtSwitch.result.diagnostics).toEqual([]);
      expect(builtSwitch.result.binary).toBeInstanceOf(Uint8Array);
    },
    LOCAL_TEST_TIMEOUT,
  );
});

// ST-B38 reads emitted text only — it never invokes the assembler — so it is
// deliberately ungated. It is the load-bearing negative, and it should run
// everywhere rather than vanish on a machine that happens to lack ACME.
describe("Specification: long-range branches keep short branches short (ST-B38)", () => {
  it(
    "ST-B38: in-range conditional branches stay short — no blanket branch-over-jump",
    () => {
      // If every conditional branch showed up wrapped in the branch-over-jump
      // trigram, the compiler would have bought assemblability by pessimising
      // the whole program — a hand assembly programmer long-forms only the
      // branches that need it. So the trigram count must sit strictly below
      // the conditional-branch count: some branches must survive short.
      //
      // Granularity: the switch probe's dispatch holds an in-range branch
      // (its nearest case body) next to the two out-of-range ones, so the
      // strict inequality binds there per program. The loop probe's ONLY
      // conditional branch is the out-of-range back edge — demanding a short
      // branch survive in that program alone would contradict its own
      // assemble requirement — so it contributes to the corpus-wide
      // inequality instead, which is what rules out a blanket wrapper.
      const dwEmit = emitAsmDoWhileRange();
      const swEmit = emitAsmSwitchRange();
      expect(dwEmit.text).toBeDefined();
      expect(swEmit.text).toBeDefined();
      const dw = branchShapeOf(dwEmit.text!);
      const sw = branchShapeOf(swEmit.text!);

      expect(dw.conditionals).toBeGreaterThan(0);
      expect(sw.conditionals).toBeGreaterThan(0);
      // The switch program must keep at least one plain short branch.
      expect(sw.branchOverJump).toBeLessThan(sw.conditionals);
      // And across both programs, wrapping EVERY conditional branch is out.
      expect(dw.branchOverJump + sw.branchOverJump).toBeLessThan(dw.conditionals + sw.conditionals);

      // Non-vacuity, the other direction: each probe must still contain a
      // branch that genuinely cannot be encoded short, or the two assemble
      // tests above would be proving nothing. Trimming a body until its span
      // fits back inside the relative reach has to fail here rather than
      // quietly turn this suite into a no-op.
      expect(dw.branchOverJump).toBeGreaterThan(0);
      expect(sw.branchOverJump).toBeGreaterThan(0);
    },
    LOCAL_TEST_TIMEOUT,
  );
});

// Block layout must NOT be gated on the optimizer flag: laying out basic
// blocks (dropping fall-through jumps, threading trampolines, inverting
// branch-over-jump trigrams, deleting unreachable epilogues) is how the code
// is EMITTED, not an optional nicety — a program compiled with the optimizer
// off must come out laid out exactly the same way. The raster-poll fixture is
// the probe because its *lowered* control flow carries every shape layout has
// to remove — a chain of jump-only blocks ahead of the poll, and a return
// epilogue past a loop that never exits — so these assertions bite hardest
// there.
describe("Specification: block layout holds under both optimizer gatings (ST-B27a..ST-B27c)", () => {
  /** The two gatings under test, labelled for actionable failure output. */
  const GATINGS: readonly { readonly name: string; readonly optimize: boolean }[] = [
    { name: "optimize on", optimize: true },
    { name: "optimize off", optimize: false },
  ];

  /** Emits the raster-poll program's ACME text under one optimizer gating. */
  function emitRasterpollText(optimize: boolean): string {
    const emit = emitAsmRasterpoll({ optimize });
    expect(emit.hasErrors).toBe(false);
    expect(emit.text).toBeDefined();
    return emit.text!;
  }

  /** The block labels inside function sections, sorted for set comparison. */
  function blockLabelsOf(asm: string): string[] {
    return parseFunctionSections(asm)
      .flatMap((section) => section.blocks.map((block) => block.label))
      .sort();
  }

  it(
    "ST-B27a: the raster-poll program is layout-clean with the optimizer on AND off",
    () => {
      for (const { name, optimize } of GATINGS) {
        const asm = emitRasterpollText(optimize);

        // Non-vacuity first: the scan must actually have seen function
        // sections, or the three clean-shape assertions below would be
        // trivially true on unparsed text.
        expect(scanCoverage(asm).functionSections, name).toBeGreaterThan(0);

        // No jump to the very next label, no block that exists only to jump
        // elsewhere, no branch hopping over a jump it could have absorbed.
        expect(fallThroughJumps(asm), name).toEqual([]);
        expect(trampolineBlocks(asm), name).toEqual([]);
        expect(branchOverJumps(asm), name).toEqual([]);
      }
    },
    LOCAL_TEST_TIMEOUT,
  );

  it(
    "ST-B27b: both gatings keep the same block labels, and the dead epilogue is gone from both",
    () => {
      const on = emitRasterpollText(true);
      const off = emitRasterpollText(false);

      // Identical surviving block-label sets: the layout decisions (which
      // blocks live, which are threaded away) must not depend on the flag.
      expect(blockLabelsOf(on).length).toBeGreaterThan(0);
      expect(blockLabelsOf(on)).toEqual(blockLabelsOf(off));

      // The program's main function loops forever, so control can never
      // reach a return — any `RTS` in its section is the dead epilogue
      // block, and it must be absent under both gatings.
      for (const [name, asm] of [
        ["optimize on", on],
        ["optimize off", off],
      ] as const) {
        const main = parseFunctionSections(asm).find((s) => s.name === "Main.main");
        expect(main, name).toBeDefined();
        const survivingRts = main!.blocks.flatMap((block) =>
          block.body.filter((instr) => /^rts$/i.test(instr.text)),
        );
        expect(survivingRts, name).toEqual([]);
      }
    },
    LOCAL_TEST_TIMEOUT,
  );

  const gatedBuilds: BuiltRangeFixture[] = [];
  afterAll(() => {
    for (const built of gatedBuilds) {
      built.cleanup();
    }
  });

  it.skipIf(!hasAcme())(
    "ST-B27c: both out-of-range probes assemble under ACME with the optimizer on AND off",
    async () => {
      // The long-branch relaxation must survive either gating: four builds
      // (each probe under each flag), and every one must yield a real binary
      // with no assembler failure.
      for (const { name, optimize } of GATINGS) {
        for (const buildProbe of [buildDoWhileRange, buildSwitchRange]) {
          const built = await buildProbe({ optimize });
          gatedBuilds.push(built);
          expect(assemblerFailures(built), name).toEqual([]);
          expect(built.result.hasErrors, name).toBe(false);
          expect(built.result.diagnostics, name).toEqual([]);
          expect(built.result.binary, name).toBeInstanceOf(Uint8Array);
        }
      }
    },
    LOCAL_TEST_TIMEOUT * 2,
  );
});

describe.skipIf(!(hasVice("c64") && hasAcme()))(
  "Specification: long-range branches on VICE (ST-B36..ST-B37)",
  () => {
    // Each probe gets its own build and its own emulator: a fresh machine per
    // binary is what makes the `$C0xx` sentinels meaningful.
    const builds: BuiltRangeFixture[] = [];
    const drivers: EmulatorDriver[] = [];

    afterAll(async () => {
      for (const driver of drivers) {
        await driver.shutdown();
      }
      for (const built of builds) {
        built.cleanup();
      }
    });

    /** Build one probe, launch a machine for it, and assert its observables. */
    async function runProbe(
      build: () => Promise<BuiltRangeFixture>,
      observables: ProgramObservables,
    ): Promise<void> {
      const built = await build();
      builds.push(built);
      expect(built.result.hasErrors).toBe(false);
      const env = await setupEmulator({ build: built.result, platform: "c64" });
      drivers.push(env.driver);
      await assertObservables(env.driver, observables, { timeout: LOCAL_TEST_TIMEOUT });
    }

    it(
      "ST-B36: the do…while probe runs its loop the right number of times on real hardware",
      () => runProbe(buildDoWhileRange, DO_WHILE_RANGE_OBSERVABLES),
      LOCAL_TEST_TIMEOUT,
    );

    it(
      "ST-B37: the switch probe dispatches to the right arm on real hardware",
      () => runProbe(buildSwitchRange, SWITCH_RANGE_OBSERVABLES),
      LOCAL_TEST_TIMEOUT,
    );
  },
);
