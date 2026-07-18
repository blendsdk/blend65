# Twin Corpus & Verification Tier: RD-02

> **Document**: 03-02-twin-corpus-and-tier.md
> **Parent**: [Index](00-index.md)

## Overview

The corpus itself: the balloon twin brought back to functional identity and labeled for
measurement, the ACME twin-assembly helper, the strict TS manifest loader, the permanent
`twins.spec.test.ts` tier, and the authorship contract governing the 13 new twins.

## Architecture

### Current

One twin (`examples/balloon/balloon.asm`), never executed by any test, and behaviorally divergent
from its source (plan-AR #1). No twin assembly path in the harness; `setupEmulator` already
accepts a bare binary + VICE label file (`fixture.ts:22-33, 117-126`).

### Proposed

Twin `.asm` → `testing/twin-assemble.ts` (ACME `--report` + `--vicelabels`) →
`setupEmulator({binary, labelFile})` → `assertObservables` with the SAME `OBSERVABLES` table the
fixture suite used (03-01). The manifest is loaded through a strict harness-internal loader.

## Implementation Details

### Balloon twin correction + window labels (plan-AR #1; RD F7)

`examples/balloon/balloon.asm`:

- Movement: ±2 steps (16-bit X: add/subtract 2 via the existing inc/dec structure or
  `clc/adc #2` — author's idiomatic choice), bounce compares become `>=`/`<=` semantics
  (`bcs`/`bcc` on `cmp`, not `bne` exact-equality), exactly mirroring `main.blend:96-103`.
  The header comment's "functionally identical" claim becomes true again.
- Labels: add `update:` at the first instruction after the raster poll (the frame-update body
  entry); `mainloop:` (existing) stays the back-edge target. These bound the measured window
  (manifest `measured.fromLabel`/`toLabel`; RD F7).
- The X bounce-at-320 check must respect ±2 stepping with `>=` (the source comment notes a 2px
  step cannot overshoot a bound given the chosen limits — the twin inherits that reasoning).

### Twin assembly: `packages/test-harness/src/testing/twin-assemble.ts` (plan-AR #8, #11)

```typescript
/** An assembled twin: PRG + VICE label file + report, in a scratch dir. */
export interface AssembledTwin {
  readonly prgPath: string;
  readonly labelPath: string;
  readonly reportPath: string;
  readonly cleanup: () => void;
}

/** Assemble one twin via real ACME (`--report` + `--vicelabels`); fail loudly with ACME stderr. */
export function assembleTwin(twinPath: string): AssembledTwin;
```

- Stages ONLY the named twin + any `.bin` assets from its directory (not sibling twins — 13 will
  co-locate in `test/golden/`).
- Honors the twin's own `!to` directive exactly as `twin-diff.mjs` does today (passing `-o`
  alongside `!to` would drop the PRG header); falls back to `-o twin.prg` when absent.
- Accepted, named duplication with the scripts-side `assembleTwin` (plan-AR #8) — one TS, one
  `.mjs`, different consumers, same `!to` rule.

### Manifest loader: `packages/test-harness/src/twin-manifest.ts` (plan-AR #6, #8)

`budget-loader.ts` pattern: `loadTwinManifest(path)` returning typed pairs; fail-loud naming
file + JSON path; unknown keys rejected. Schema per plan-AR #6:

```typescript
export interface TwinPair {
  readonly source: string;                       // repo-relative example dir
  readonly twin: string;                         // repo-relative twin .asm
  readonly measured?: {
    readonly window: string;                     // must match a budgets.json window name
    readonly fromLabel: string;                  // twin-side label
    readonly toLabel: string;
    readonly cycles: number;                     // the TWIN's quiesced reference
  };
  readonly routing?: Readonly<Record<string, readonly RoutingEntry[]>>;
  // keys: exactly twin-diff's five category strings (CATEGORIES)
}

export interface RoutingEntry {
  readonly disposition: "structural" | "peephole" | "data/placement" | "ceremony" | "parity";
  readonly issue?: number;        // required unless parity; forbidden with parity
  readonly sourceForced?: boolean; // RD F8 annotation
  readonly note?: string;
}
```

Validation errors name which vocabulary was violated (mechanical category key vs routing
disposition — `"data placement"` vs `"data/placement"` collide visually and must never collide
in a message). Off the package barrel (test-only, `index.ts:10-11` posture).

The five mechanical category strings live here as a **local frozen copy** (plan-preflight
PF-006): the package cannot import `scripts/`' `CATEGORIES` export across the module boundary,
and this is exactly plan-AR #8's named `.mjs`/`.ts` duplication. Rename drift is caught
mechanically — a renamed category makes every routing key stale, and the generator's
stale-routing error (plan-AR #7) fails loudly before any output.

### Twin tier: `packages/test-harness/src/twins.spec.test.ts` (RD F2; req-AR #16, #19)

- `describe.skipIf(!(hasVice("c64") && hasAcme()))`, sequential per the existing
  `fileParallelism: false` config.
- Loads the manifest; for each pair: `assembleTwin` → `setupEmulator({binary, labelFile})` →
  `assertObservables(driver, <FIXTURE>_OBSERVABLES, {symbols, loopHeadLabel: <twin's label>})`.
  Twin-side loop-head labels come from a small per-pair table in the tier (rasterpoll/balloon
  only — the other 12 sets use memory landmarks; gate's set likewise).
- Balloon measured case (RD F7 / AC-6): `stopCleanlyAt`-equivalent at `update`, `quiesce`,
  `measureCycles(vice, symbols, "update", "mainloop")`; asserts the fresh measurement
  **equals** `measured.cycles` exactly. Two-fresh-process determinism is already proven by the
  budget tier for the generated side; the twin side asserts once per run (the recorded reference
  itself was established across two processes when first measured — an execution-time step).
- Negative case (RD AC-2): a deliberately byte-flipped copy of one twin's observable expectation
  fails naming exactly that twin (implemented against a temp-copied manifest/table, not by
  mutating committed assets).

### Budget-tier amendment (RD AC-6 / PF-012)

`budgets.spec.test.ts:311-317`: the balloon measured check becomes exact equality with
`measuredMaxCycles` (`expect(counts[0]).toBe(window.measuredMaxCycles)`), replacing
`checkCostWithinBudget`'s ≤. The ratchet-bites negative case stays.

### Twin authorship contract (RD F1 + Technical Requirements; plan-AR #3)

Restated only where the plan adds precision:

- Equivalence contract = the fixture's `OBSERVABLES` table, nothing more. Source-mandated
  addresses only; the twin chooses its own ZP layout, registers, addressing, data placement.
- Style: ACME, plain-language comments to the fixtures' doc standard, BASIC-stub entry like the
  balloon twin, `!to "<name>.prg", cbm` naming its output.
- Where the fixture source is un-idiomatic due to a language gap, the twin shows the idiomatic
  form (RD F8) — the balloon copy-loop precedent (`balloon.asm:20-26`).
- slice8 note (plan-preflight PF-009): the shared `$D020 == $F2` landmark is mod-16 aliased
  (counts 4, 20, …, 100 all display as color 2) — the twin must actually SATURATE its counter
  (100 bumps) so the landmark is deterministic, not transiently matched; the fixture side keeps
  proving saturation through its local counter/mirror waits.
- Authoring order (Phase 3 batches): gate → slice3a → slice3b → slice4a · slice4b → slice5a →
  slice5b → slice6 · slice7 → slice7b → slice8 → slice8b · rasterpoll — complexity-ascending,
  each batch ending green on the twin tier before the next starts.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| ACME failure on a twin | Fail naming the twin path + ACME stderr (twin-diff posture) | plan-AR #8 |
| Manifest pair without a golden / golden without a pair | Tier asserts pair-set == corpus-set (mirrors the budget tier's corpus-coverage spec) | plan-AR #6 |
| `measured.window` absent from `budgets.json` | Loader/tier error naming both files | plan-AR #6 |
| Twin label file missing a required label | `runUntilLabelArrivals`' unknown-label error names the twin | plan-AR #2 |

## Testing Requirements

Owned by [07-testing-strategy.md](07-testing-strategy.md): ST-9…ST-13.
