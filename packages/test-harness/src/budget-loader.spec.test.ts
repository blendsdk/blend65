/**
 * Specification tests for the budget-file loader: the budgets data file is
 * validated strictly and loudly — unknown keys, missing required fields, and
 * kind/field mismatches fail naming the file and the JSON path, before any
 * budget assertion could silently no-op against a malformed file.
 */

import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadBudgetFile } from "./budget-loader.js";

/** Write `content` as a budgets.json in a fresh temp dir, returning its path. */
function stageBudgets(content: unknown): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "b65-budgets-"));
  const path = join(dir, "budgets.json");
  writeFileSync(path, JSON.stringify(content, null, 2), "utf8");
  return { path, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const VALID_WINDOW = {
  name: "copyLoop",
  fromLabel: "Main_copyBytes_L0",
  toLabel: "Main_copyBytes_L3",
  kind: "span",
  staticMaxCycles: 40,
};

describe("Specification: budget-file loader validation", () => {
  it("should load a well-formed budgets file", () => {
    const staged = stageBudgets({
      programs: { slice8b: { bytes: 500, windows: [VALID_WINDOW] } },
    });
    try {
      const budgets = loadBudgetFile(staged.path);
      expect(budgets.programs.slice8b.bytes).toBe(500);
      expect(budgets.programs.slice8b.windows[0].name).toBe("copyLoop");
    } finally {
      staged.cleanup();
    }
  });

  it("should fail naming the file and path on an unknown key", () => {
    const staged = stageBudgets({
      programs: { slice8b: { bytes: 500, windows: [], maxBytes: 9 } },
    });
    try {
      expect(() => loadBudgetFile(staged.path)).toThrowError(/budgets\.json.*programs\.slice8b.*maxBytes/s);
    } finally {
      staged.cleanup();
    }
  });

  it("should fail naming the file and path when bytes is missing", () => {
    const staged = stageBudgets({ programs: { slice8b: { windows: [] } } });
    try {
      expect(() => loadBudgetFile(staged.path)).toThrowError(/budgets\.json.*programs\.slice8b.*bytes/s);
    } finally {
      staged.cleanup();
    }
  });

  it("should fail naming the file and path when a span window lacks its static budget", () => {
    const { staticMaxCycles: _dropped, ...spanWithoutBudget } = VALID_WINDOW;
    const staged = stageBudgets({
      programs: { slice8b: { bytes: 500, windows: [spanWithoutBudget] } },
    });
    try {
      expect(() => loadBudgetFile(staged.path)).toThrowError(
        /budgets\.json.*programs\.slice8b\.windows\[0\].*staticMaxCycles/s,
      );
    } finally {
      staged.cleanup();
    }
  });
});
