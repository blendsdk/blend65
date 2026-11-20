# Dispatch residual closure (#170, bounded unit)

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: T-36 / #170
> **Progress**: 0/7 tasks (0%)
> **Status**: Planned — witness-channel design pending challenger reconciliation
> **Last Updated**: 2026-11-20
> **Baseline**: `26c316db`, clean `feature/v4-rebuild`
> **Scope**: strict; the dispatch thunk's block termination and the machine-stage refusal diagnostic
> **Reasoning**: high — a lowering terminator and a validator, both on the refusal path, where a
> wrong answer either accepts a malformed program or refuses a legal one
> **Commit mode**: `--auto-commit` (commit and push after each verified task; a critical or major
> review finding still stops for a ruling)
> **Created**: 2026-11-20

## Objective and authority

Close the two residuals that keep issue #170 open. Neither is a new investigation: the preceding
unit proved both causes and specified both remedies, and this unit applies them.

| Half | Residual | Why it was not fixed in the preceding unit |
| --- | --- | --- |
| A | A dispatch whose every candidate never returns is refused on the thunk route and accepted on the comparison-chain route, so the **argument count decides whether the program compiles** | The lowering change would have invalidated that unit's byte-neutrality evidence. The objection expired when the unit closed |
| B | The machine-stage refusal carries no span and names no construct | Out of that unit's scope; it is a diagnostic contract, not a flag-fact repair |

The authority for half A is the comparison chain, which already answers this shape correctly. The
authority for half B is the prime directive: an author on a C64 has no debugger, so a refusal that
names neither a file nor a construct leaves nothing to act on, and that message is itself the
defect.

## Measured starting state

Reproduced at this baseline, not recalled. Both programs are identical except for one unused
parameter, which is the whole point.

| Program | Dispatch route | Result |
| --- | --- | --- |
| Two never-returning candidates, call takes **zero** arguments | Thunk (`jmp (ptr)`) | **Refused** — `error[COMPILER_INCOMPLETE]: The machine storage binding stage is not complete for this program` |
| Two never-returning candidates, call takes **one** argument | Comparison chain (`cmp #<(b65_Game_spinA_…)`) | **Builds**, two unused-parameter warnings only |

The refusal envelope carries `code = COMPILER_INCOMPLETE`, `span = None`, and the message above.
No file, no line, no construct.

**No test anywhere in the repository asserts `COMPILER_INCOMPLETE`.** A search of every TypeScript
file outside `node_modules` finds the code only at its two construction sites,
`services/services.ts` and `services/size-selection.ts`. This refusal is an internal invariant
guard that has never had a demonstrated legal trigger, and that fact shapes half B's acceptance
below.

## Half A — smallest viable design

Mirror the comparison chain. The chain terminates an arm `unreachable` when the whole-program
summary proves that candidate never returns (`lower-indirect.ts:233-258`), and it reaches the
`returningBodies` map through `state.input.program.interruptOwnership`, which the thunk route can
read at the same point. The thunk route currently keeps the caller's block open and appends `jsr`
to it (`lower-indirect.ts:120-164`), so the fix is to close that block instead:

- When **no** candidate returns, push the caller's block with the `jsr` appended and an
  `unreachable` terminator, then continue at a fresh `${prefix}.continue` label with no
  instructions — structurally what `lower-indirect.ts:249-260` already does for the chain.
- When **any** candidate returns or is unknown, the current behaviour is correct and unchanged.

The route is only reachable with zero arguments, and a program on it today is refused rather than
compiled, so no program that currently builds can change by a byte. That claim is an acceptance
check, not an assumption.

## Half B — smallest viable design

The refusal path is `bind.ts:585` → `{ kind: "error", reason: "invalid-storage" }` →
`size-selection.ts:512` → `incomplete("machine storage binding")`, whose body at
`size-selection.ts:240-249` passes `null` as the span. A span is available: `projectDiagnostic`
accepts `primarySpan` (`project/diagnostics.ts:105-117`) and `MachineInstruction.source` is a
`SourceSpan | null` (`machine-types.ts:430`).

The constraint is that `validateMachineProgram` is consumed as a bare boolean at **six** sites, and
five of them are not the refusal path:

| Site | Purpose |
| --- | --- |
| `machine/bind.ts:585` | The refusal path |
| `services/size-observers.ts:123`, `:124` | Size observation |
| `layout/c64-layout.ts:913`, `:918` | Layout and compaction decisions |
| `artifacts/acme-validate.ts:84` | Artifact validation |

**Recommendation, pending reconciliation** (an independent challenger is deciding this question
without being told this preference; its verdict and the reconciliation are recorded in the design
decision section before task 3 starts): express the predicate in terms of a single
witness-producing implementation rather than converting all six sites. One internal function
returns the first failing check as a witness or `null`, `validateMachineProgram` stays a boolean
wrapper over it so the five non-reporting sites are untouched, and the refusal path reads the
witness and carries it on the bind error. The checks then exist once, which the alternative of a
second explain-only pass would violate.

A witness must name a construct rather than a stage. The candidate contents are the failing check's
identity, the owning function, the block label and the instruction's `source` span. A
compiler-synthesized block such as a dispatch thunk has `source: null` on its own instructions but
is synthesized from a call site that does have a span, so the fallback behaviour is part of the
design decision, not an afterthought.

### Why half B is proved at unit level and not end to end

Half A's fix makes the only known refusing program build. Since no legal source program is known
to trigger this refusal once that defect is repaired, demanding an end-to-end source demonstration
would either block the diagnostic indefinitely or invite a contrived program that proves nothing.
The validator's existing implementation tests already construct `MachineProgram` values directly
(`machine/validate-flags.impl.test.ts`, 31 cases), so the witness and its span are provable there,
plus one test at the boundary that a failing bound program yields a diagnostic whose span is not
null. This is stated as a deliberate scope decision so that a reviewer can reject it rather than
discover it.

## Tasks

- [ ] T-36.1 Record the measured starting state as evidence: both programs, both routes, the
      refusal envelope with its null span, and the absence of any `COMPILER_INCOMPLETE` assertion
      in the repository. Capture pre-change baselines for the dispatch controls and all seven
      examples so byte-neutrality is measurable rather than asserted
- [ ] T-36.2 Author the specification oracle for half A from the issue acceptance only, with
      implementation-blind authorship, and reproduce RED. A never-returning dispatch must compile
      the same way whether or not the call takes an argument. Freeze the oracle by hash; never edit
      it afterwards
- [ ] T-36.3 Settle the witness-channel design: reconcile the independent challenger's verdict with
      the recommendation above, record the decision and the rejected options with their reasons,
      then enumerate every consumer the chosen channel touches before writing code
- [ ] T-36.4 Implement half A: terminate the caller's block `unreachable` on the thunk route when
      no candidate returns. Verify the frozen oracle turns GREEN and that the dispatch controls and
      all seven examples stay byte-identical
- [ ] T-36.5 Implement half B behind the settled design: the witness, the span on the refusal, and
      a message that names the construct. Accepted output must stay byte-identical, since a
      diagnostic may not move a single emitted byte
- [ ] T-36.6 Add implementation tests for both halves: the thunk route's terminator for every
      returning/non-returning candidate combination, the witness for a failing bound program
      including the synthesized-block fallback, and the non-regression controls the public oracle
      cannot express
- [ ] T-36.7 Independent reviews for the affected contracts, then the closeout: disposition every
      finding, run the checkpoint, sync both roadmap tiers, and post the issue evidence. A critical
      or major finding stops for a ruling

## Verify

Per task: the targeted suites for the files the task touched, run from the owning package
(`packages/compiler` needs its own config: `yarn vitest run src/...`; the root config only includes
`test/**`). Before each commit: `yarn test:changed --host` and `yarn test`.

At closeout, a **split checkpoint with a written containment argument** rather than `yarn test:full`,
following the established policy that the full corpus is not run unless it is necessary. The
argument must name which emulator files can reach a dispatch block or a machine-stage refusal and
why the excluded ones cannot; the preceding unit's twelve-file affected list is the starting point
and must be re-derived, not inherited.

## Out of scope

| Item | Owner |
| --- | --- |
| Unfolded signed comparison against a constant | #172 |
| Sibling lowering routes that retain a register value and could drop the same metadata | #171, pending the user's close-or-audit ruling |
| Raw-write residuals from the preceding unit's reviews | #164 |
| Unifying the two span-less refusal constructors across the service layer | Part of the task 3 design decision only if the chosen channel requires it; otherwise untouched |

## Design decisions

| # | Decision | Status |
| --- | --- | --- |
| D-1 | Half A mirrors the comparison chain's non-returning test rather than introducing a second mechanism | Settled — the chain is the existing authority for this shape |
| D-2 | The witness channel for the machine-stage refusal | **Open** — challenger dispatched, reconciliation due in T-36.3 |
| D-3 | Half B's acceptance is proved at unit level, with the reason recorded | Settled, and stated so a reviewer can reject it |
| D-4 | Half A lands before half B, because half B's message is only reachable once the known defect on that path is gone | Settled |
