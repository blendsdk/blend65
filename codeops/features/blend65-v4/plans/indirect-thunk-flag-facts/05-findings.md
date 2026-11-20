# Findings: indirect-call thunk flag facts (#170)

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: T-35 / #170
> **Status**: Diagnosis complete; fix design awaiting the user's ruling
> **Baseline**: `e79c367b`, clean `feature/v4-rebuild`
> **Created**: 2026-11-20

## What the compiler refuses

A program that calls through a function pointer and then performs **one addition or
subtraction** is rejected outright:

```
error[COMPILER_INCOMPLETE]: The machine storage binding stage is not complete for this program
```

No loop is required. This is the smallest refused program measured:

```blend65
module Game;
function chosen(): byte { return 37; }
function other(): byte { return 11; }
function main(): void {
  let hook: fn(): byte = &chosen;
  if (peek($C000) == 1) { hook = &other; }
  let i: byte = 0;
  poke($C100, hook());
  i = i + 1;            // remove this one line and the program builds
  poke($C101, i);
}
```

## The proved causal chain

Every link below was observed directly, by instrumenting the built `dist` and running the CLI.
The `dist` was restored from byte-exact backups afterwards; no source file was changed.

| Step | Location | Observed |
| --- | --- | --- |
| 1 | `machine/lower-indirect.ts:99-107` | A multi-target indirect call takes the **thunk route**: `jsr <thunk>`, where the thunk is one helper block holding `jmp (ptr)` with terminator `unreachable` |
| 2 | `machine/validate-flags.ts:222-230` | A callable's return facts are gathered only from blocks whose terminator is `return` or whose last instruction is `rts`. The thunk tail-transfers, so it owns no returning block and `hasReturn` stays `false` |
| 3 | `machine/validate-flags.ts:232-236` | With `hasReturn === false` the summary collapses to `{ returns: 0, preserves: 0 }`. Probe: `PROBE callee target=…indirect.0.thunk returns=0 preserves=0 valid=true` |
| 4 | `machine/validate-flags.ts:143` | At the call site `available = (available & preserves) \| returns` therefore becomes `0`. **Every** flag fact is discarded, including the decimal flag |
| 5 | `machine/validate-flags.ts:124-127` | The next `adc`/`sbc` consumes `d` and `c`. Probe: `opcode=adc uses=["d","c"] available=49 required=36` — `c` is present, `d` has no producer, so `valid` becomes `false` |
| 6 | `machine/bind.ts:585-587` | `validateMachineProgram` returns `false`, so `bindMachineProgram` returns `{ kind: "error", reason: "invalid-storage", requestId: null }` |
| 7 | `services/size-selection.ts:511-512` | The error is mapped to `incomplete("machine storage binding")`, surfacing as `COMPILER_INCOMPLETE` |

The emitted code is correct. A `jsr` into a `jmp (ptr)` thunk is exactly what an expert 6502
developer writes for a two-byte pointer dispatch, and the target's own `rts` returns straight to
the caller. `test/rd04/expert-calls.impl.test.ts:83-101` already pins that exact shape as the
expert expectation and passes today, so the fix must leave the thunk in place.

The thunk's `{ kind: "unreachable" }` terminator is nonetheless a control-flow lie, and flag
validation is only its first victim rather than its only one: `services/entry-path-cycles.ts:324`
marks a path failed on reaching an `unreachable` terminator, so worst-case cycle accounting
already gives up on any route through a thunk, and `machine/nmi-entry.ts:46` calls `preserveAll()`
on an indirect `jmp`, inflating NMI wrappers. Neither is in scope here; both would consult the
same fact the repair records.

## Measured shape matrix

One ingredient changed per row, all on the same project.

| Program | Route taken | Result |
| --- | --- | --- |
| Local scalar callable, 2 targets, `i = i + 1` after the call | thunk | **refused** |
| Same, with the addition removed | **thunk** | **builds** — proves the thunk itself is accepted |
| Same, `i = i - 1` instead | thunk | **refused** (`sbc` also consumes `d`) |
| Same, `i = i << 1` instead | thunk | builds — a shift consumes no decimal flag |
| Same, addition placed **before** the call | thunk | builds — only consumers reachable *after* the call are affected |
| Same, addition inside a **callee** invoked after the call | thunk | builds — a non-startup entry starts with `d`/`i` established (`validate-flags.ts:169`) |
| One distinct target only | direct `jsr` | builds — `lower-indirect.ts:47-56` emits a direct arm |
| Callable takes an argument | compare chain | builds |
| Callable in a local struct field | compare chain | builds |
| Callable in a module-level variable | compare chain | builds |

The compare-chain route is identifiable in the emitted assembly by `cmp #<(…)` / `cmp #>(…)`
against each candidate's address; the thunk route by `jmp (`.

The thunk route's preconditions are read directly from `lower-indirect.ts:88-98`: at least two
targets, no interrupt-context variant, zero arguments, a scalar/enum/function return type, the
pointer held in a RAM storage home with at least two bytes at its offset, and a pointer whose low
byte is not `$FF`. When the home is not found in placement, `pointer` stays `-1`, whose low byte
*is* `$FF`, so the guard sends those shapes down the compare chain — this is why the struct-field
and module-level cases build.

## Corrections to the original #170 report

Three claims in the filed issue are measurably wrong and must be corrected:

| Filed claim | Measured |
| --- | --- |
| Refusal needs a loop that assigns a local declared outside the loop body | The loop is **incidental**. It was only the shortest way to place an increment after the call. A straight-line addition refuses identically with no loop anywhere |
| Refusal needs the call "not strictly after the loop" | The real relation is that an `adc`/`sbc` must be **reachable after the indirect call inside the same body** |
| `check` performs no code generation, so the refusal is semantic | `checkProject` runs `closeCanonicalStorage` (`services/services.ts:240-247`), which performs full storage closure **and** machine binding. The refusal comes from machine-flag validation, not semantic analysis |

The four-condition rule in the issue collapses to one: **a thunk-route indirect call with an
`adc` or `sbc` reachable after it in the same body.**

## What the validator actually tracks

`validate-flags.ts:38-43` tracks two things, and neither is a flag *value*: `flags` records
whether a **producer exists** on every incoming path, and `preserved` records whether a bit still
**equals the callable's entry bit**. No repair considered here detects a genuine decimal-mode
leak, because `sed` is itself a producer (`:149-151`). The repair restores buildability; it must
not be credited with BCD safety.

## Why the ABI-floor shortcut is unsound

Keeping a fixed `d|i` floor across an unknown callee would assume no Blend65 function ever
changes the decimal or interrupt flag. Both assumptions are false in this compiler:
`machine/lower-arithmetic.ts:181,205,224,391,443` emits `sed` for BCD arithmetic, and
`layout/startup.ts:497,828,847` plus `layout/startup-status.ts:163` emit `sei`/`cli`.

The floor is also keyed on the wrong predicate. "Owns no returning block" equally describes
callees that genuinely never return — the `returningBodies === false` arms at
`lower-indirect.ts:215-218` — for which a preservation floor is meaningless, while for the thunk
control *does* return. And it discards the candidates' `returns` facts, which the validator
deliberately uses (`machine/validate-flags.impl.test.ts:174-200`), so it would trade this
refusal for two fresh wrong answers: refusing a program whose candidates both establish a flag
the caller then consumes, and accepting one whose candidate genuinely clobbers a consumed flag.

Why the missing producer is `d` specifically: startup establishes it with a single `cld`
(`layout/startup-status.ts:176`), propagated to every function entry through `ABI_FLAGS`
(`validate-flags.ts:169`), and binary `adc`/`sbc` emit no local `cld`
(`lower-arithmetic.ts:223-234`). The affected set is therefore exactly code consuming `d` or `i`
after a thunk-route call **in the same function**, which accounts for every row of the matrix
above.

## Candidate fix designs

| Option | Shape | Verdict |
| --- | --- | --- |
| **B — exact meet** | Record the thunk's finite candidate set on its block; the validator summarises the thunk as the meet of its candidates' own summaries | **Selected.** Exact, needs no ABI axiom, and uses the target set `lowerIndirectCall` already holds at `lower-indirect.ts:34` |
| A′ — ABI floor | Treat a tail-transferring callee as preserving `d`/`i` | Rests on an invariant this compiler already violates, and trades this refusal for two fresh wrong answers (above) |
| B′ — meet over all functions | Intersect every function's summary | Sound but non-local: adding an unrelated function could refuse an untouched call site |
| C — `php`/`plp` in the thunk | Save and restore status around the dispatch | 7 cycles and 2 bytes on every indirect call, and `plp` rolls back the callee's returned N/Z/C — an expert expects a pointer call to behave like a direct call |
| D — drop the thunk route | Always use the compare chain | Deletes correct, already-qualified codegen to compensate for a validator blind spot; cost scales with the candidate count |
| F — emit `cld` after the thunk `jsr` | The codebase's own idiom for an unknown callee (`machine/lower-load-unit.ts:174-175`) | That precedent applies where the hardware truth is unknown. Here the callees are known Blend65 functions whose BCD sequences restore `cld` themselves (`lower-arithmetic.ts:193,217,237,272`), so this pays 2 bytes and 2 cycles per call to re-establish an invariant that already holds |
| New terminator kind | Model the tail transfer as a distinct exit | Over 200 sites switch on `MachineTerminator.kind`, including byte size, cycle accounting and both ACME emitters. The `jmp (ptr)` already lives in `instructions`, so a block field records the same truth with no emission risk |

### Selected design

| Element | Decision |
| --- | --- |
| Record | `readonly indirectTargets?: readonly string[]` on `MachineBlock`, holding `bindingLabel("fn", candidate)` for each entry of `targets`, written at `machine/lower-indirect.ts:100-108` |
| Consume | At summary assembly, `machine/validate-flags.ts:230-236`: keep the ordinary walk of the thunk body, then replace its summary with the meet over `analyze(candidate)` |
| Call site | Unchanged. `validate-flags.ts:107-115` already routes `jsr <thunk>` through `analyze`, and `:143` consumes the summary as-is |
| Key on | The recorded set, **not** on `hasReturn === false` — the latter also describes genuinely non-returning callees |
| Cycle fallback | A candidate already in `active` contributes `{ returns: 0, preserves: 0 }` **without** poisoning `valid`, so a self-referential function pointer keeps its current acceptance. Safe because that early return never reaches the cache write at `:237` and every candidate is still verified independently by the top-level sweep at `:240` |

Soundness invariant: every execution of `jsr T` transfers to the entry of some candidate in the
recorded set and returns exactly as a direct `jsr` to that candidate would, because `jmp (ptr)`
consumes no stack slot and the candidate's own `rts` pops the thunk's return address. The sound
summary of `T` is therefore the meet over the set — the same operation the validator already
applies at a control-flow join (`meetStatus`, `:52-54`). It rests on one assumption: the recorded
set is complete, which is the front end's existing finite-target obligation
(`lower-indirect.ts:44-46`). A dropped or stale field degrades to today's `{0,0}` and a refusal;
no path turns it into a miscompile.

### Integration hazards

Audited and safe:

| Site | Why it survives |
| --- | --- |
| `bindFunction` — `machine/bind.ts:283-297` | Rebuilds with `Object.freeze({ ...block, instructions })`; optional fields pass through |
| `shareBoundRootBodies` — `machine/bind.ts:493-543` | The identity fingerprint is `JSON.stringify([fn.sourceName, fn.blocks])` excluding only observer fields, so the new field participates and two thunks with different sets cannot merge |
| `redirectBoundLabels` — `machine/bind.ts:446-490` | Would not rewrite the new field, but its redirect keys are only merged-away irq-root ids, which never match a plain `fn.<key>` candidate label. Needs a comment at the field declaration so a future extension cannot silently invalidate it |
| `shareBoundByteMultiplyHelpers`, `mergeObserverBlock` | Spread the existing block; both operate on fingerprint-identical bodies |

Open and decisive for implementation:

| Hazard | Detail |
| --- | --- |
| `validateMachineProgram` runs at **six call sites**, not one | `machine/bind.ts:585`, `services/size-observers.ts:123,124` (physical and final), `layout/c64-layout.ts:913,918` (resolved and compacted), `artifacts/acme-validate.ts:84`. The field must survive every block-rewriting pass up to ACME validation |
| Unaudited rebuild sites | `selectTerminalByteLeaves`/`selectByteWindows` (`machine/lower-function.ts:1029-1049`), `selectSwitchDispatch` (`:1022`), `machine/optimization-cleanup.ts`, and post-layout compaction. Precedent is encouraging but not conclusive: the optional block field `observerBodies` is already read at post-layout stages |
| Retained true negatives | The validator must still reject a thunk whose candidate genuinely clobbers a consumed flag |

The end-to-end artifact test is what settles the survival question: compiling the repro through
the full CLI pipeline exercises every validation site, which a direct
`validateMachineProgram` unit call does not.

## Test axes the repair must satisfy

| Axis | Shape | Expected |
| --- | --- | --- |
| Repro, end-to-end | The exact refused program, compiled through the full CLI pipeline to an artifact | Builds, emitting `jsr <thunk>` and `jmp (ptr)`. This is the test that enforces field survival across every validation site |
| Precision | Both candidates establish a flag the caller consumes afterwards with no local producer | Accepted. The ABI-floor designs refuse this |
| True negative | One candidate performs an opaque restore (`pha`/`plp`), then `adc` after the call | Refused — the meet drops `d`. The ABI-floor designs wrongly accept |
| Meet semantics | One candidate establishes a consumed flag, the other clobbers it | Refused |
| Thunk body checks still live | Thunk reached with an unbalanced stack shape, or a duplicate label | Refused, as today |
| Indirect recursion | A callable storing its own address and called through it | Acceptance unchanged from before the repair |
| Route coverage | Every row of the shape matrix above | Each builds via its documented route |
| Controls that stay red | `machine/validate-flags.impl.test.ts:202,220,236` and `:100` | Unchanged failures |
| Frozen oracles | `machine/status-provenance.spec.test.ts`, `machine/terminal-legality.spec.test.ts` | Unchanged, green, never edited |

## Out of scope for this unit

| Item | Why it stays out |
| --- | --- |
| The null-span diagnostic | `COMPILER_INCOMPLETE` carries `primarySpan: null`, `related: []`, `help: null`, `pointer: null`. Named as a second defect in #170; it spans five emission sites (`services/services.ts:156,396,495`, `services/size-selection.ts:244,1017`) and is its own bounded unit |
| Unmodelled absolute `jsr` | `machine/validate-flags.impl.test.ts:202` pins `{0,0}` for a `jsr` the validator cannot resolve, which would refuse `i = i + 1` after a KERNAL call the same way. `machine/lower-load-unit.ts:174-175,197` compensates with an explicit `cld`. Whether user code can reach a raw KERNAL `jsr` without that compensation is **unverified**; if it can, it is a separate defect of the same family |
| Cycle accounting and NMI wrappers through a thunk | `services/entry-path-cycles.ts:324` and `machine/nmi-entry.ts:46` are the thunk terminator's other victims. Not refusals, so not this unit |
