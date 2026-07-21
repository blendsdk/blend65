/**
 * Specification: every idiom recorded as inexpressible really is still
 * inexpressible, in exactly the way recorded.
 *
 * The parity scoreboard compares generated code against hand-written assembly,
 * so it can only ever see programs that compile. A restriction that stops a
 * program being written at all is invisible to it — no ratio moves, no golden
 * changes, nothing goes red. Several such restrictions survived a long run of
 * green measurements for precisely that reason, and were eventually found by
 * hand rather than by a failing test.
 *
 * This suite is the missing instrument. `expressiveness-ledger.json` names each
 * idiom a game developer would reach for, the minimal program that expresses
 * it, and what the compiler does with that program today. Every entry is
 * compiled here and checked against its record.
 *
 * The direction of the assertion is the unusual part, and is deliberate: each
 * entry asserts that a **defect is still present**. When someone removes a
 * restriction, this suite goes red. That is the intended signal — it forces the
 * ledger entry to be retired in the same change that fixes the gap, so the
 * ledger cannot quietly drift into describing a compiler that no longer exists.
 * A red result here is read as "an entry needs deleting", never as "the fix was
 * wrong".
 *
 * Two kinds of entry, because two kinds of failure:
 *
 * - **diagnostic** — the compiler refuses the program. The recorded code must
 *   appear among the diagnostics.
 * - **miscompiles** — the compiler accepts the program and emits wrong or
 *   grossly inefficient code. There is no diagnostic to assert, so the entry
 *   names a signature that must appear in the emitted assembly instead. These
 *   are the dangerous entries: a developer gets no warning at all.
 *
 * Runs everywhere — `emitAsm` stops before ACME, so no assembler and no
 * emulator are involved.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emitAsm } from "@blend65/compiler";

/** The committed ledger directory — budgets, twins, manifests and this ledger. */
const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "golden");

/** How the compiler currently fails the idiom. */
type Expectation = "diagnostic" | "miscompiles";

interface LedgerEntry {
  /** Stable identifier, referenced from the roadmap and from issues. */
  readonly id: string;
  /** What the developer was trying to do, in their terms. */
  readonly idiom: string;
  /** A minimal, self-contained program expressing it. */
  readonly source: string;
  readonly expect: Expectation;
  /** For `diagnostic` entries: the code that must fire. */
  readonly code?: string;
  /** For `miscompiles` entries: text that must appear in the emitted assembly. */
  readonly asmSignature?: string;
  /** The decision that authorised the restriction, or an explicit statement that none did. */
  readonly governedBy: string;
  /** Who is scheduled to remove it. */
  readonly owner: string;
  readonly note?: string;
}

interface Ledger {
  readonly entries: readonly LedgerEntry[];
}

const ledger: Ledger = JSON.parse(
  readFileSync(join(GOLDEN_DIR, "expressiveness-ledger.json"), "utf8"),
) as Ledger;

/**
 * Compiles one entry's source through the real frontend and codegen, stopping
 * before ACME. Each entry gets its own directory so nothing leaks between them.
 */
function compileEntry(entry: LedgerEntry): { codes: string[]; asm: string } {
  const cwd = mkdtempSync(join(tmpdir(), "b65-ledger-"));
  try {
    const file = join(cwd, "main.blend");
    writeFileSync(file, entry.source, "utf8");
    const result = emitAsm({ platform: "c64", sourceFiles: [file], cwd, quiet: true });
    return {
      codes: result.diagnostics.map((d) => d.code),
      asm: result.text ?? "",
    };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe("expressiveness ledger", () => {
  it("records at least one entry, and every entry is well-formed", () => {
    expect(ledger.entries.length).toBeGreaterThan(0);
    for (const entry of ledger.entries) {
      expect(entry.id, "every entry needs a stable id").toMatch(/^X-\d+$/);
      expect(entry.idiom.length, `${entry.id}: needs an idiom in the user's terms`).toBeGreaterThan(
        0,
      );
      expect(
        entry.governedBy.length,
        `${entry.id}: name the decision, or say none did`,
      ).toBeGreaterThan(0);
      expect(
        entry.owner.length,
        `${entry.id}: an unowned gap is how gaps get orphaned`,
      ).toBeGreaterThan(0);
      if (entry.expect === "diagnostic") {
        expect(entry.code, `${entry.id}: a diagnostic entry must name its code`).toBeTruthy();
      } else {
        expect(
          entry.asmSignature,
          `${entry.id}: a miscompile entry must name an assembly signature`,
        ).toBeTruthy();
      }
    }
  });

  it("uses unique ids", () => {
    const ids = ledger.entries.map((e) => e.id);
    expect(new Set(ids).size, "duplicate ledger ids").toBe(ids.length);
  });

  for (const entry of ledger.entries) {
    it(`${entry.id} — ${entry.idiom}`, () => {
      const { codes, asm } = compileEntry(entry);

      if (entry.expect === "diagnostic") {
        expect(
          codes,
          `${entry.id} is recorded as rejected with ${entry.code}. If this now compiles, the ` +
            `restriction was lifted — delete the entry in the change that lifted it.`,
        ).toContain(entry.code);
        return;
      }

      // A miscompile: the program is accepted, and the defect shows in the output.
      expect(
        codes.filter((c) => c.startsWith("E")),
        `${entry.id} is recorded as compiling silently; it now reports an error instead. ` +
          `If the defect became a diagnostic, change the entry's kind — or delete it.`,
      ).toHaveLength(0);
      expect(
        asm,
        `${entry.id} is recorded as emitting '${entry.asmSignature}'. If that is gone, the ` +
          `defect was fixed — delete the entry in the change that fixed it.`,
      ).toContain(entry.asmSignature);
    });
  }
});
