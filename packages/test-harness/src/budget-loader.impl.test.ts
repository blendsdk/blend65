/**
 * Implementation tests for the budget-file loader: kind/field mismatches,
 * type violations, malformed JSON, and the exact-ratchet boundary — the
 * validation edges beyond the specification's headline cases.
 */

import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkCostWithinBudget, loadBudgetFile } from "./budget-loader.js";
import { AssertionError } from "./run/assertions.js";

/** Write raw text as a budgets.json in a fresh temp dir. */
function stageRaw(content: string): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "b65-budgets-impl-"));
  const path = join(dir, "budgets.json");
  writeFileSync(path, content, "utf8");
  return { path, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function stage(content: unknown): { path: string; cleanup: () => void } {
  return stageRaw(JSON.stringify(content));
}

const BASE_WINDOW = {
  name: "w",
  fromLabel: "a",
  toLabel: "b",
};

describe("Implementation: budget-loader validation edges", () => {
  it("should reject a perIteration window carrying span fields", () => {
    const staged = stage({
      programs: {
        p: {
          bytes: 1,
          windows: [
            { ...BASE_WINDOW, kind: "perIteration", staticCyclesPerIteration: 5, staticMaxCycles: 9 },
          ],
        },
      },
    });
    try {
      expect(() => loadBudgetFile(staged.path)).toThrowError(/windows\[0\].*staticMaxCycles/s);
    } finally {
      staged.cleanup();
    }
  });

  it("should reject a span window carrying perIteration fields", () => {
    const staged = stage({
      programs: {
        p: {
          bytes: 1,
          windows: [{ ...BASE_WINDOW, kind: "span", staticMaxCycles: 9, staticCyclesPerIteration: 5 }],
        },
      },
    });
    try {
      expect(() => loadBudgetFile(staged.path)).toThrowError(/windows\[0\].*staticCyclesPerIteration/s);
    } finally {
      staged.cleanup();
    }
  });

  it("should reject an unknown window kind", () => {
    const staged = stage({
      programs: { p: { bytes: 1, windows: [{ ...BASE_WINDOW, kind: "loop", staticMaxCycles: 1 }] } },
    });
    try {
      expect(() => loadBudgetFile(staged.path)).toThrowError(/windows\[0\]\.kind/);
    } finally {
      staged.cleanup();
    }
  });

  it("should reject non-integer and negative budget values", () => {
    for (const bytes of ["12", -1, 1.5] as const) {
      const staged = stage({ programs: { p: { bytes, windows: [] } } });
      try {
        expect(() => loadBudgetFile(staged.path)).toThrowError(/programs\.p\.bytes/);
      } finally {
        staged.cleanup();
      }
    }
  });

  it("should reject malformed JSON naming the file", () => {
    const staged = stageRaw("{ not json");
    try {
      expect(() => loadBudgetFile(staged.path)).toThrowError(/budgets\.json/);
    } finally {
      staged.cleanup();
    }
  });

  it("should reject a windows value that is not an array", () => {
    const staged = stage({ programs: { p: { bytes: 1, windows: {} } } });
    try {
      expect(() => loadBudgetFile(staged.path)).toThrowError(/programs\.p\.windows/);
    } finally {
      staged.cleanup();
    }
  });
});

describe("Implementation: ratchet boundary", () => {
  it("should throw an AssertionError one over and pass at and below the budget", () => {
    expect(() => checkCostWithinBudget("p", "m", 101, 100)).toThrowError(AssertionError);
    expect(() => checkCostWithinBudget("p", "m", 100, 100)).not.toThrow();
    expect(() => checkCostWithinBudget("p", "m", 99, 100)).not.toThrow();
  });
});
