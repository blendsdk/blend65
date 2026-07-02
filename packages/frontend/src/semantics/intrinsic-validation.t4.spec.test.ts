/**
 * Specification tests for the RD-17 T4 import-boundary validation (ST-15, ST-16).
 *
 * Derived EXCLUSIVELY from RD-17 (R19/R25, AR-P14) and AC-05/AC-06 — never from
 * implementation. These depend on the T4 fixture plugin that Phase 5 wires, so they
 * are authored now as `.todo` (per exec plan task 2.1.1) and un-`.todo`'d in Phase 5
 * task 5.1.1 once `createIntrinsicRegistry(fixturePlugin.intrinsics)` + the fixture
 * `.asm` exist.
 *
 * Expected behaviour (AR-P14 — user chose Option A: distinct codes):
 * - ST-15: a T4 intrinsic (`fix_probe`) called on its owning platform (c64) WITHOUT
 *   `import { fix_probe } from c64;` → E10046 (IntrinsicNotImported), message
 *   `"'fix_probe' requires 'import { fix_probe } from c64;'"`.
 * - ST-16: the same T4 intrinsic targeting a different platform (a7800), with or
 *   without the import → E10043 (IntrinsicUnavailable — wrong platform, R25).
 */

import { describe, it } from "vitest";

describe("Specification: RD-17 T4 import-boundary validation (ST-15, ST-16)", () => {
  it.todo(
    "ST-15: fix_probe() on c64 without import → E10046 (Phase 5 wires the fixture)",
  );

  it.todo(
    "ST-16: fix_probe() targeting a7800 (import or not) → E10043 (Phase 5 wires the fixture)",
  );
});
