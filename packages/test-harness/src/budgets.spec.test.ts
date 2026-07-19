/**
 * The ratcheting budget tier: assembled byte budgets and named cycle windows
 * for every corpus program, asserted from the committed
 * `test/golden/budgets.json`.
 *
 * - Bytes + static windows run wherever ACME is present (the CI tier) — the
 *   bytes assertion IS the size-regression gate.
 * - Measured windows run on real VICE only (local tier). The measured
 *   programs carry no interrupt discipline of their own, so the harness
 *   quiesces them first; their budgets are QUIESCED machine cycles, identical
 *   across fresh emulator processes.
 *
 * Budgets ratchet exactly: a cost equal to its budget passes, one over
 * fails naming the program, the actual, and the budget.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { BuildResult } from "@blend65/compiler";
import { cycleRange, parseReportFile, type ReportInstruction } from "@blend65/compiler";

import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import { ViceDriver } from "./emulator/vice/vice-driver.js";
import { measureCycles, quiesce } from "./run/measure.js";
import {
  checkCostWithinBudget,
  loadBudgetFile,
  type BudgetWindow,
} from "./budget-loader.js";
import { buildGate } from "./testing/gate.js";
import { buildGuards } from "./testing/guards.js";
import { buildSlice3a } from "./testing/slice3a.js";
import { buildSlice3b } from "./testing/slice3b.js";
import { buildSlice4a } from "./testing/slice4a.js";
import { buildSlice4b } from "./testing/slice4b.js";
import { buildSlice5a } from "./testing/slice5a.js";
import { buildSlice5b } from "./testing/slice5b.js";
import { buildSlice6 } from "./testing/slice6.js";
import { buildSlice7 } from "./testing/slice7.js";
import { buildSlice7b } from "./testing/slice7b.js";
import { buildSlice8 } from "./testing/slice8.js";
import { buildSlice8b } from "./testing/slice8b.js";
import { buildRasterpoll } from "./testing/rasterpoll.js";
import { buildBalloon } from "./testing/balloon.js";

const BUDGETS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "test",
  "golden",
  "budgets.json",
);

/** The PRG load-address header excluded from every byte figure. */
const PRG_HEADER_BYTES = 2;
const LOCAL_TEST_TIMEOUT = 240000;
const MEASURE_TIMEOUT = 60000;

/**
 * The hand-computed static max-sum of one rasterpoll poll iteration —
 * the TEXTUAL sum of every instruction between the poll-loop head and its
 * exit label, transcribed from the committed `rasterpoll.asm.golden` + the
 * documented NMOS timings (all branches stay in one page, max = taken):
 *   LDA $D012 (4) + CMP #$FB (2) + BNE L4 (3) + JMP L5 (3) + JMP L3 (3)
 *   = 15.
 * The compare's own flags carry the branch, so nothing stands between the
 * `CMP` and the `BNE`. The path actually walked while the raster has not
 * arrived — load, compare, branch taken, and the body block's jump back — is
 * 12 of those cycles; the remaining `JMP L5` is the exit, walked once.
 */
const EXPECTED_POLL_ITERATION_MAX_CYCLES = 15;

/**
 * The hand-computed static max-sum of one guards compound-guard evaluation —
 * the TEXTUAL sum of both clause blocks, from the lower-bound test to the
 * block the guard admits to, transcribed from the committed
 * `guards.asm.golden` + the documented NMOS timings (all branches stay in one
 * page, max = taken):
 *   lower clause: LDA probe (4) + CMP #$08 (2) + BCS (3) + JMP (3)  = 12
 *   upper clause: LDA probe (4) + CMP #$28 (2) + BCC (3) + JMP (3)  = 12
 *   = 24, every cycle of which is either the compare or the branch it
 * decides — nothing builds a 0/1 for the next test to read back.
 */
const EXPECTED_COMPOUND_GUARD_MAX_CYCLES = 24;

/** A built corpus program: the compiler build result + scratch cleanup. */
interface BuiltProgram {
  readonly result: BuildResult;
  readonly cleanup: () => void;
}

/** Program name → builder, spanning the full golden corpus + balloon. */
const BUILDERS: Record<string, () => Promise<BuiltProgram>> = {
  gate: buildGate,
  slice3a: buildSlice3a,
  slice3b: buildSlice3b,
  slice4a: buildSlice4a,
  slice4b: buildSlice4b,
  slice5a: buildSlice5a,
  slice5b: buildSlice5b,
  slice6: buildSlice6,
  slice7: buildSlice7,
  slice7b: buildSlice7b,
  slice8: buildSlice8,
  slice8b: buildSlice8b,
  guards: buildGuards,
  rasterpoll: buildRasterpoll,
  balloon: buildBalloon,
};

/** The report file every build writes beside its binary. */
function reportPathOf(built: BuiltProgram): string {
  const binaryPath = built.result.binaryPath;
  if (binaryPath === undefined) {
    throw new Error("build produced no binary path — cannot locate its ACME report");
  }
  return binaryPath.replace(/\.prg$/, ".report");
}

/** Parse the build's ACME report into classified instruction records. */
function instructionsOf(built: BuiltProgram): ReportInstruction[] {
  const path = reportPathOf(built);
  return parseReportFile(readFileSync(path, "utf8"), path);
}

/**
 * The instructions inside a window's static text slice.
 *
 * A window runs from arrival at `fromLabel` to arrival at `toLabel`. When
 * the end label sits ABOVE the start (the normal span), the slice is the
 * address range [from, to). When it sits at or BELOW it (a loop-shaped
 * window whose end is the loop head, e.g. a frame loop's update body), the
 * slice runs from the body start through the back-edge transfer that
 * targets the end label — the same pair of labels the measured run uses.
 */
function windowSlice(
  instructions: readonly ReportInstruction[],
  program: string,
  window: BudgetWindow,
  from: number,
  to: number,
): ReportInstruction[] {
  if (to > from) {
    return instructions.filter((i) => i.address >= from && i.address < to);
  }
  const slice: ReportInstruction[] = [];
  for (const instruction of instructions) {
    if (instruction.address < from) continue;
    slice.push(instruction);
    const transfers = instruction.opcode === "JMP" || instruction.mode === "Relative";
    if (transfers && instruction.operand === to) {
      return slice;
    }
  }
  throw new Error(
    `${program} window '${window.name}': no back-edge transfer to '${window.toLabel}' found after '${window.fromLabel}'`,
  );
}

/** Sum the min–max cycle range of the instructions inside a window's slice. */
function sliceCycleSum(
  instructions: readonly ReportInstruction[],
  symbols: Map<string, number>,
  program: string,
  window: BudgetWindow,
): { min: number; max: number } {
  const from = symbols.get(window.fromLabel);
  const to = symbols.get(window.toLabel);
  if (from === undefined || to === undefined) {
    const missing = from === undefined ? window.fromLabel : window.toLabel;
    throw new Error(`${program} window '${window.name}': label '${missing}' is not in the symbol map`);
  }
  let min = 0;
  let max = 0;
  for (const instruction of windowSlice(instructions, program, window, from, to)) {
    const range = cycleRange(instruction);
    min += range.min;
    max += range.max;
  }
  return { min, max };
}

/** Stop at `label` via a tracked checkpoint that is deleted afterwards. */
async function stopCleanlyAt(
  vice: ViceDriver,
  symbols: Map<string, number>,
  label: string,
): Promise<void> {
  const address = symbols.get(label);
  if (address === undefined) {
    throw new Error(`label '${label}' is not in the symbol map`);
  }
  const checkpoint = await vice.setCheckpoint(address);
  expect(await vice.resume()).toBe("breakpoint");
  await vice.deleteCheckpoint(checkpoint);
}

/** Launch a built program on VICE, narrowed to the concrete driver. */
async function launchOnVice(
  built: BuiltProgram,
): Promise<{ vice: ViceDriver; symbols: Map<string, number> }> {
  const env = await setupEmulator({ build: built.result, platform: "c64" });
  if (!(env.driver instanceof ViceDriver)) {
    throw new Error("expected the c64 platform to provide a ViceDriver");
  }
  return { vice: env.driver, symbols: env.symbols };
}

describe("Specification: budget ratchet semantics", () => {
  it("should fail naming program, actual, and budget when a cost exceeds it", () => {
    expect(() => checkCostWithinBudget("gate", "assembled bytes", 300, 256)).toThrowError(
      /gate.*assembled bytes.*300.*256/s,
    );
  });

  it("should pass at exactly the budget (ratchet boundary)", () => {
    expect(() => checkCostWithinBudget("gate", "assembled bytes", 256, 256)).not.toThrow();
  });
});

describe("Specification: budgets cover exactly the corpus", () => {
  it("should budget every corpus program and nothing else", () => {
    const budgeted = Object.keys(loadBudgetFile(BUDGETS_PATH).programs).sort();
    expect(budgeted).toEqual(Object.keys(BUILDERS).sort());
  });
});

describe.skipIf(!hasAcme())("Specification: budget tier — bytes + static windows", () => {
  const budgets = loadBudgetFile(BUDGETS_PATH);

  for (const [name, program] of Object.entries(budgets.programs)) {
    it(
      `${name}: assembled size and static windows hold their budgets`,
      async () => {
        const builder = BUILDERS[name];
        expect(builder, `no builder for budgeted program '${name}'`).toBeDefined();
        const built = await builder();
        try {
          expect(built.result.hasErrors).toBe(false);
          const bytes = built.result.binary!.length - PRG_HEADER_BYTES;
          checkCostWithinBudget(name, "assembled bytes", bytes, program.bytes);

          if (program.windows.length > 0) {
            const instructions = instructionsOf(built);
            const symbols = built.result.symbolMap!;
            for (const window of program.windows) {
              const { max } = sliceCycleSum(instructions, symbols, name, window);
              const budget =
                window.kind === "span" ? window.staticMaxCycles : window.staticCyclesPerIteration;
              checkCostWithinBudget(name, `window '${window.name}' static max cycles`, max, budget);
            }
          }
        } finally {
          built.cleanup();
        }
      },
      LOCAL_TEST_TIMEOUT,
    );
  }

  it(
    "slice8b copyLoop: the ratchet bites one below the current static max",
    async () => {
      const window = budgets.programs.slice8b.windows.find((w) => w.name === "copyLoop")!;
      const built = await buildSlice8b();
      try {
        const { max } = sliceCycleSum(instructionsOf(built), built.result.symbolMap!, "slice8b", window);
        expect(() =>
          checkCostWithinBudget("slice8b", "window 'copyLoop' static max cycles", max, max - 1),
        ).toThrowError(/slice8b.*copyLoop/s);
      } finally {
        built.cleanup();
      }
    },
    LOCAL_TEST_TIMEOUT,
  );

  it(
    "guards compoundGuard: per-iteration static cycles equal the hand-computed clause sum",
    async () => {
      const window = budgets.programs.guards.windows.find((w) => w.name === "compoundGuard")!;
      const built = await buildGuards();
      try {
        const { max } = sliceCycleSum(
          instructionsOf(built),
          built.result.symbolMap!,
          "guards",
          window,
        );
        expect(max).toBe(EXPECTED_COMPOUND_GUARD_MAX_CYCLES);
      } finally {
        built.cleanup();
      }
    },
    LOCAL_TEST_TIMEOUT,
  );

  it(
    "rasterpoll pollIter: per-iteration static cycles equal the hand-computed poll-body sum",
    async () => {
      const window = budgets.programs.rasterpoll.windows.find((w) => w.name === "pollIter")!;
      const built = await buildRasterpoll();
      try {
        const { max } = sliceCycleSum(
          instructionsOf(built),
          built.result.symbolMap!,
          "rasterpoll",
          window,
        );
        expect(max).toBe(EXPECTED_POLL_ITERATION_MAX_CYCLES);
      } finally {
        built.cleanup();
      }
    },
    LOCAL_TEST_TIMEOUT,
  );
});

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: budget tier — measured windows", () => {
  const budgets = loadBudgetFile(BUDGETS_PATH);

  it(
    "balloon frameUpdate: identical quiesced measurements across two fresh processes, equal to the committed figure",
    async () => {
      const window = budgets.programs.balloon.windows.find((w) => w.name === "frameUpdate")!;
      expect(window.kind).toBe("span");
      const built = await buildBalloon();
      try {
        const counts: number[] = [];
        for (let run = 0; run < 2; run++) {
          const { vice, symbols } = await launchOnVice(built);
          try {
            // Stop at the window entry's FIRST arrival, mask interrupts, then
            // measure the next full arrival-to-arrival window. The window sits
            // below the visible display area (raster >= 251), so no display
            // blank is needed.
            await stopCleanlyAt(vice, symbols, window.fromLabel);
            await quiesce(vice);
            counts.push(
              await measureCycles(vice, symbols, window.fromLabel, window.toLabel, MEASURE_TIMEOUT),
            );
          } finally {
            await vice.shutdown();
          }
        }
        expect(counts[0]).toBe(counts[1]);
        // The committed figure IS the measurement, not a ceiling: any drift —
        // faster or slower — must surface and be consciously re-recorded.
        if (window.kind === "span" && window.measuredMaxCycles !== undefined) {
          expect(counts[0]).toBe(window.measuredMaxCycles);
        }
        // The ratchet bites: one below the current measurement fails.
        expect(() =>
          checkCostWithinBudget("balloon", "window 'frameUpdate' measured cycles", counts[0], counts[0] - 1),
        ).toThrowError(/balloon.*frameUpdate/s);
      } finally {
        built.cleanup();
      }
    },
    LOCAL_TEST_TIMEOUT,
  );

  // slice8b's one-shot copy window runs inside the boot frame, whose badline
  // latch (DEN seen at raster $30) survives any mid-frame display blank — its
  // measured cost is therefore phase-dependent by 0–2 badlines and carries no
  // measured budget. Its static budget is exact, and the measured guarantees
  // are proven by balloon's recurring window above.
});
