# Manifest Routing, Scoreboard & CI: RD-02

> **Document**: 03-03-manifest-scoreboard-ci.md
> **Parent**: [Index](00-index.md)

## Overview

The scripts side: the shared corpus library extracted from `twin-diff.mjs` (landing in Step 2.4,
BEFORE the corpus needs its multi-module fix — plan-preflight PF-001), the scoreboard generator
with its routing enforcement (Phase 4), the CI freshness step, and the audit workflow that fills
the routing block (Phase 5).

## Architecture

### Current

`twin-diff.mjs` is self-contained: internal `loadManifest`/`buildGeneratedSide`/`assembleTwin`,
exported `classifyDivergences` (imported by `test/twin-diff.impl.test.ts:10`), `fail()` =
`process.exit(1)` with a `twin-diff:` prefix (`twin-diff.mjs:29`; NOT pinned by any spec today —
`test/twin-diff.spec.test.ts:114` pins the path-rejection *message* only; the 2.4 amendment adds
the prefix pin — plan-preflight PF-005). `buildGeneratedSide` hardcodes
`sourceFiles: ["main.blend"]` (`twin-diff.mjs:187`).

### Proposed

```
scripts/lib/twin-corpus.mjs   ← shared: loadManifest (strict, full schema), buildGeneratedSide
                                 (multi-module fix), assembleTwin (named-twin staging), and the
                                 CATEGORIES definition; THROWS
scripts/twin-diff.mjs         ← keeps classifyDivergences export + RE-exports CATEGORIES from
                                 the lib (import point unchanged) + its CLI/prefix
scripts/gen-parity-scoreboard.mjs ← new; imports lib + classifyDivergences/CATEGORIES
```

## Implementation Details

### `scripts/lib/twin-corpus.mjs` (plan-AR #8)

- `loadManifest(path)` — the strict validator over the full plan-AR #6 schema (mirrors
  `twin-manifest.ts`; the `.mjs`/`.ts` pair is the register's accepted duplication).
- `buildGeneratedSide(compiler, sourceDir)` — enumerates the staged `.blend` files
  (`main.blend` first, remainder sorted) instead of hardcoding; unblocks slice5a/5b/7/7b.
- `assembleTwin(twinPath)` — stages only the named twin + `.bin` assets.
- All functions **throw**; each CLI catches and maps to exit 1 under its own stderr prefix
  (`twin-diff:` stays pinned; the generator uses `gen-parity-scoreboard:`).
- `twin-diff.mjs` re-imports from the lib; its CLI behavior, exports, and spec tests are
  regression-guarded by the existing root-`test/` suites, with a two-stage deliberate spec
  amendment (plan-preflight PF-001): at Phase 3 start the `unpaired` membership pins become a
  computed-consistency assertion (`unpaired == goldens − manifest keys`, valid at every corpus
  state); at corpus completion it pins empty (RD F3; the world state the spec pinned changes by
  requirement).

### `CATEGORIES` export (plan-AR #6)

The five mechanical category strings (`"instruction selection"`, `"layout"`,
`"data placement"`, `"addressing modes"`, `"register usage"`) are **defined as a frozen array in
`scripts/lib/twin-corpus.mjs`** and re-exported from `twin-diff.mjs` (plan-AR #6 addendum,
plan-preflight PF-006) — the decided export surface is preserved while avoiding a lib↔CLI
import cycle. Consumers: the lib's own strict `loadManifest` and the generator. The TS loader
(`twin-manifest.ts`) cannot import across the package boundary and carries a local frozen copy —
plan-AR #8's named duplication; rename drift is caught mechanically by the stale-routing error
(plan-AR #7), which fires before any output.

### `scripts/gen-parity-scoreboard.mjs` (RD F4, F6; req-AR #15, #17, #19)

RD-01 script conventions throughout (path canonicalization + outside-repo rejection, argv-array
spawns, "run 'yarn build' first" guidance, CLI-gated exports for unit-testable logic).

Pipeline:

1. Load manifest (lib) + `budgets.json` (light local read; the TS `budget-loader` is
   package-internal). Inputs are overridable — `--manifest <path>` / `--budgets <path>`,
   defaulting to the committed files (plan-AR #11 addendum, plan-preflight PF-002): the spec
   tier's temp-input path (ST-16/17/19/20) and Phase 5's draft-routed preview both need it;
   both flags run through the same repo-inside canonicalization as `--out`.
2. Per pair: build generated side, assemble twin, parse both reports, compute bytes/static-cycle
   ratios and `classifyDivergences` rows — the same numbers `twin-diff` reports.
3. **Routing enforcement, before writing ANY output** (RD F6; plan-AR #7): compute each pair's
   divergence-category set; exit non-zero naming every group (pair × category) that lacks a
   routing entry, AND every routing key whose category has zero computed rows (stale). Also
   cross-check `measured.window` against the program's `budgets.json` window.
4. Render deterministic markdown (no timestamps; sorted pair iteration): summary table (bytes
   gen/twin/ratio, static cycles gen/twin/ratio, two decimals), corpus totals row, measured
   columns on rows with committed measured data (generated from `budgets.json`
   `measuredMaxCycles`, twin from `measured.cycles`, ratio two decimals), then per-pair routing
   sections — mechanical category, disposition(s), issue links, `sourceForced` annotation
   (RD F8) with its note.
5. Write `packages/test-harness/test/golden/SCOREBOARD.md` (default) or `--out <path>`
   (all three path flags repo-inside enforced). Never launches VICE; needs built packages +
   ACME only.

Root alias: `"gen:scoreboard": "node scripts/gen-parity-scoreboard.mjs"`.

### CI freshness step (RD F5; req-AR #17)

After the existing informational twin-diff step (kept as-is per RD F5):

```yaml
- name: Scoreboard freshness
  run: yarn gen:scoreboard && git diff --exit-code -- packages/test-harness/test/golden/SCOREBOARD.md
```

Regenerate + diff is the literal RD wording; a stale committed scoreboard fails the job, and the
routing enforcement inside the generator makes "zero unclassified groups" permanent through this
same step (RD AC-5). No new tokens, no PR comments (req-AR #17 posture).

### The audit workflow (RD F6; plan-AR #9)

Execution-time protocol, in order:

1. Run `yarn twin:diff` over the completed corpus; collect every divergence group
   (pair × mechanical category).
2. Analyze each group with the annotator + listings as evidence; draft disposition(s) per group —
   the expert-assembly judgment call (structural → #50/#51/#53 or new issue; peephole → #52;
   data/placement → #49; ceremony → #59; parity → none).
3. **Present the complete routing table to the user; wait for confirmation** (plan-AR #9;
   01-requirements plan-local AC-3).
4. Only then: write the `routing` blocks into `twins.json`, append/reference/file the GitHub
   issues (`gh` CLI), regenerate + commit `SCOREBOARD.md`.
5. Umbrella #56 gets its re-sweep checklist item (RD AC-9); the area report posts to #61 at RD
   close (RD AC-10).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Unrouted divergence group | Exit non-zero naming pair + category, no output written | plan-AR #6, RD F6 |
| Stale routing key (no computed rows) | Same — error before output | plan-AR #7 |
| Malformed manifest / budgets | Throw → exit 1 naming file + JSON path + violated vocabulary | plan-AR #6, #8 |
| `--out` outside repo | Reject before any work (RD-01 posture, `twin-diff.mjs:34-40`) | plan-AR #8 |
| Missing dist / ACME | "run 'yarn build' first" guidance / ACME stderr passthrough | plan-AR #8 |

## Testing Requirements

Owned by [07-testing-strategy.md](07-testing-strategy.md): ST-14…ST-19.
