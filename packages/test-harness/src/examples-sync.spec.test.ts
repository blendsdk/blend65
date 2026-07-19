/**
 * Specification: every inlined fixture source is byte-for-byte identical to
 * its committed `examples/` counterpart.
 *
 * The `examples/` tree is the oracle: the harness inlines fixture sources as
 * documentation-adjacent constants, and any drift means a test builds a
 * program that is not the program the repository publishes. Multi-module
 * fixtures pin EVERY inlined module, not just `main.blend`.
 *
 * Exempt by design: the balloon program (built from `examples/balloon/`
 * directly, nothing inlined) and binary `.bin` assets (copied, never
 * inlined). Runs everywhere — no ACME or VICE needed.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { GATE_SRC } from "./testing/gate.js";
import { GUARDS_MAIN_SRC } from "./testing/guards.js";
import { RASTERPOLL_MAIN_SRC } from "./testing/rasterpoll.js";
import { SLICE3A_SRC } from "./testing/slice3a.js";
import { SLICE3B_SRC } from "./testing/slice3b.js";
import { SLICE4A_SRC } from "./testing/slice4a.js";
import { SLICE4B_SRC } from "./testing/slice4b.js";
import { SLICE5A_MAIN_SRC, SLICE5A_MATH_SRC } from "./testing/slice5a.js";
import { SLICE5B_MAIN_SRC, SLICE5B_MATH2_SRC, SLICE5B_MATH_SRC } from "./testing/slice5b.js";
import { SLICE6_MAIN_SRC } from "./testing/slice6.js";
import { SLICE7_GFX_SRC, SLICE7_MAIN_SRC } from "./testing/slice7.js";
import { SLICE7B_GAME_SRC, SLICE7B_MAIN_SRC } from "./testing/slice7b.js";
import { SLICE8_MAIN_SRC } from "./testing/slice8.js";
import { SLICE8B_MAIN_SRC } from "./testing/slice8b.js";

/** The repository root (this file lives at packages/test-harness/src). */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Every inlined module across the 14 inlined-source programs. */
const INLINED_MODULES: ReadonlyArray<{
  readonly fixture: string;
  readonly module: string;
  readonly inlined: string;
}> = [
  { fixture: "gate", module: "main.blend", inlined: GATE_SRC },
  { fixture: "slice3a", module: "main.blend", inlined: SLICE3A_SRC },
  { fixture: "slice3b", module: "main.blend", inlined: SLICE3B_SRC },
  { fixture: "slice4a", module: "main.blend", inlined: SLICE4A_SRC },
  { fixture: "slice4b", module: "main.blend", inlined: SLICE4B_SRC },
  { fixture: "slice5a", module: "main.blend", inlined: SLICE5A_MAIN_SRC },
  { fixture: "slice5a", module: "math.blend", inlined: SLICE5A_MATH_SRC },
  { fixture: "slice5b", module: "main.blend", inlined: SLICE5B_MAIN_SRC },
  { fixture: "slice5b", module: "math.blend", inlined: SLICE5B_MATH_SRC },
  { fixture: "slice5b", module: "math2.blend", inlined: SLICE5B_MATH2_SRC },
  { fixture: "slice6", module: "main.blend", inlined: SLICE6_MAIN_SRC },
  { fixture: "slice7", module: "main.blend", inlined: SLICE7_MAIN_SRC },
  { fixture: "slice7", module: "gfx.blend", inlined: SLICE7_GFX_SRC },
  { fixture: "slice7b", module: "main.blend", inlined: SLICE7B_MAIN_SRC },
  { fixture: "slice7b", module: "game.blend", inlined: SLICE7B_GAME_SRC },
  { fixture: "slice8", module: "main.blend", inlined: SLICE8_MAIN_SRC },
  { fixture: "slice8b", module: "main.blend", inlined: SLICE8B_MAIN_SRC },
  { fixture: "rasterpoll", module: "main.blend", inlined: RASTERPOLL_MAIN_SRC },
  { fixture: "guards", module: "main.blend", inlined: GUARDS_MAIN_SRC },
];

describe("Specification: inlined fixture sources match the committed examples", () => {
  for (const { fixture, module, inlined } of INLINED_MODULES) {
    it(`should hold examples/${fixture}/${module} verbatim`, () => {
      const committed = readFileSync(join(REPO_ROOT, "examples", fixture, module), "utf8");
      expect(inlined).toBe(committed);
    });
  }
});
