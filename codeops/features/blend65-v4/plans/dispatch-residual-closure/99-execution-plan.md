# Dispatch residual closure (#170, bounded unit)

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: T-36 / #170
> **Progress**: 2/7 tasks (29%)
> **Status**: Executing — baselines captured, witness channel settled
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

**Settled** (see the design decision section for the challenger's reconciliation): keep the boolean
predicate and express it through one defect finder that returns the first failing check or `null`.
`validateMachineProgram` becomes that finder compared against `null`, so its signature does not
move; the refusal path at `bind.ts:585` reads the defect and carries it on the bind error; and the
message is formatted in `services/`, which is the layer that already owns span fallbacks.

**One of the six consumers changes.** The decisive reason is not taste: **frozen specification
oracles assert the boolean directly** — `machine/terminal-legality.spec.test.ts:58`,
`machine/status-provenance.spec.test.ts:139,149,165,199,224` and
`machine/optimization-rules.spec.test.ts:147`, seven assertions of the form
`expect(validateMachineProgram(...)).toBe(...)`. Those files may never be edited, so a result-object
signature is not available at any price. Verified by direct search, not assumed.

A witness must name a construct rather than a stage. The failing check's phrasing and the
instruction's `source` span carry the message; the function identity, block label and opcode belong
in a `help` line as bug-report evidence, never in the primary sentence. A dispatch thunk's own
instructions are built with the call site's span (`lower-indirect.ts:110` and `:122-129`), so the
synthesized-block fear is narrower than it first appears; the genuinely span-less case is generated
startup, where the fallback lands on `main` and the message must name the stage rather than invent
a construct.

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

- [x] T-36.1 Record the measured starting state as evidence: both programs, both routes, the
      refusal envelope with its null span, and the absence of any `COMPILER_INCOMPLETE` assertion
      in the repository. Capture pre-change baselines for the dispatch controls and all seven
      examples so byte-neutrality is measurable rather than asserted ✅ (evidence below; both
      tables reproduced from independent working directories)
- [ ] T-36.2 Author the specification oracle for half A from the issue acceptance only, with
      implementation-blind authorship, and reproduce RED. A never-returning dispatch must compile
      the same way whether or not the call takes an argument. Freeze the oracle by hash; never edit
      it afterwards
- [x] T-36.3 Settle the witness-channel design: reconcile the independent challenger's verdict with
      the recommendation above, record the decision and the rejected options with their reasons,
      then enumerate every consumer the chosen channel touches before writing code ✅ (D-2, D-5,
      D-6; the challenger ran before any code was written, and its frozen-oracle finding was
      verified by direct search rather than accepted on report)
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
| D-2 | The witness channel: a null-returning defect finder behind the unchanged boolean, the defect carried on the bind error, the message formatted in `services/` | Settled by the reconciliation below |
| D-3 | Half B's acceptance is proved at unit level, with the reason recorded | Settled, and stated so a reviewer can reject it |
| D-4 | Half A lands before half B, because half B's message is only reachable once the known defect on that path is gone | Settled |
| D-5 | `validate-flags.ts` captures its first defect into a side slot and leaves its accumulating `valid` dataflow untouched | Settled by the reconciliation below |
| D-6 | The two span-less refusal constructors stay separate | Settled — they return different types, and the service-stage one has no program to witness |

### D-2 and D-5 — challenger reconciliation

An independent challenger decided the witness channel without being told any preference. It
converged on the same channel this plan recommended, and it supplied a constraint the plan did not
have, which is the reason the decision is now closed rather than merely agreed:

| What the challenger contributed | Effect |
| --- | --- |
| Frozen spec oracles assert `validateMachineProgram` as a boolean at seven assertions in three files | Converting all six consumers is **impossible**, not merely noisy. Confirmed by direct search before adoption |
| `c64-layout.ts:913/918` guards a compaction decision and `size-observers.ts` contributes one clause to a multi-term certificate predicate | Neither has any consumer for a witness, so changing them would add noise for nothing |
| `machine/` imports `project/diagnostics` as a type only, and cannot reach the span-fallback inputs | The message must be formatted in `services/`, matching how machine lowering failures are already reported |
| `validate-flags.ts` accumulates `valid &&= …` **deliberately** without short-circuiting, and its summary cache fill order affects precision | **Do not convert it to early returns.** Capture the first defect into a side slot and leave the dataflow byte-for-byte. This is what makes "no accepted program changes" checkable rather than hoped for |
| No test anywhere pins the diagnostic code or its message text | Message, span and help text are free to change. Independently confirmed |
| The eager-witness option costs allocation on the accepted path, and these validators run per size-mode candidate | A `T \| null` finder allocates nothing when the program is accepted, which is also the existing house idiom (`validateHomes` returns `string \| null`) |

**The challenger's strongest objection is accepted, not dismissed:** a span on a
compiler-limitation message points a caret at innocent, correct source, and an author who trusts
the caret will start editing a line that is not wrong. That is arguably worse than no location at
all. The mitigation is that the message must say plainly that this is a compiler limitation rather
than an error on that line, and the `help` line must carry the report-this evidence. A reviewer
should judge the final wording against exactly this objection.

Two further cautions carried into implementation: the defect reported first is deterministic per
program but not canonical, because it follows a work-list order, so tests pin the code, the
category and the **presence** of a non-null span, never a span offset. And `MachineFunction.sourceName`
is optional, so the formatter reuses the existing name derivation rather than assuming it is
populated.

## T-36.1 evidence — accepted-output baselines before any production change

Captured at `c6266da9` on 2026-11-20. Values are the first 16 hex digits of a SHA-256 over emitted
bytes only. **Both tables were produced twice from independent working directories and agree
exactly**; a first attempt did not, because the digest covered `.build.json` and `current.json`,
which record the generation identity and change on every run. Those two files are excluded, and
everything else an example emits is included.

| Control | `none` | `balanced` | `speed` | `size` |
| --- | --- | --- | --- | --- |
| `thunk-returning` — two returning candidates, zero arguments | `7747321da81ddd4a` | `63441a4adb873dc6` | `63441a4adb873dc6` | `63441a4adb873dc6` |
| `thunk-mixed` — one returning, one never-returning | `981f9f52d2780665` | `1447854d79000d08` | `1447854d79000d08` | `1447854d79000d08` |
| `thunk-result` — two returning candidates with a consumed result | `4cdd3773fcdf2ee3` | `4bdc1996fbccadc0` | `4bdc1996fbccadc0` | `4bdc1996fbccadc0` |
| `thunk-nonreturning` — **the defect**: no candidate returns, zero arguments | `REFUSED` | `REFUSED` | `REFUSED` | `REFUSED` |
| `chain-nonreturning` — the same program with one argument | `9b933bfd10918db9` | `15d915955d9f73e6` | `15d915955d9f73e6` | `15d915955d9f73e6` |
| `chain-returning` — returning candidates with one argument | `e291985f6f25f9f3` | `ca42881e1ddabbdf` | `ca42881e1ddabbdf` | `ca42881e1ddabbdf` |
| `single-target` — one candidate, no dispatch | `ae6b8adac5c9940e` | `d74b449a402f14bc` | `d74b449a402f14bc` | `d74b449a402f14bc` |

The two rows that matter are adjacent: `thunk-nonreturning` is refused and `chain-nonreturning`
builds, and they differ only by one unused parameter. The three optimized modes agree with each
other and differ from `none` throughout, which is the expected shape.

| Example | Digest |
| --- | --- |
| `boing-ball` | `75fecef4c692b1eb` |
| `foundation` | `aafbc004571cc57c` |
| `m1` | `edcd65feab8c43c5` |
| `rd06-assets` | `93b812b661aac655` |
| `rd06-charpad` | `c9eb256171b24324` |
| `rd06-spritepad` | `a4d7702851e776a4` |
| `rd07-loadable` | `811dd3d3e6d7d011` |

A control for a module-level callable was dropped rather than recorded as refused: its source
declared an initializer at module level, which is `E10010` — a language rule about executable
statements, with nothing to say about dispatch. Keeping a `REFUSED` row for it would have implied a
dispatch defect that does not exist.

No example declares callable-typed storage, so the corpus is expected to be untouched by either
half. It is captured as an independent guard, not as the primary evidence.

## T-36.1 appendix — the control programs the digests were taken from
These are recorded so the pinned digests above can be re-derived rather than remembered. Each
builds against the same manifest: entry `Game`, target `c64-pal-prg-kernal-6581`, source root
`src`, with the optimization mode supplied per build.

### `thunk-returning`

```
module Game;
function one(): void { poke($C100, 1); }
function two(): void { poke($C100, 2); }
function main(): void {
  let hook: fn(): void = &one;
  if (peek($C000) == 1) { hook = &two; }
  hook();
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, i);
}
```

### `thunk-mixed`

```
module Game;
function one(): void { poke($C100, 1); }
function spin(): void { while (true) { } }
function main(): void {
  let hook: fn(): void = &one;
  if (peek($C000) == 1) { hook = &spin; }
  hook();
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, i);
}
```

### `thunk-nonreturning`

```
module Game;
function spinA(): void { while (true) { } }
function spinB(): void { while (true) { } }
function main(): void {
  let hook: fn(): void = &spinA;
  if (peek($C000) == 1) { hook = &spinB; }
  hook();
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, i);
}
```

### `chain-nonreturning`

```
module Game;
function spinA(n: byte): void { while (true) { } }
function spinB(n: byte): void { while (true) { } }
function main(): void {
  let hook: fn(byte): void = &spinA;
  if (peek($C000) == 1) { hook = &spinB; }
  hook(7);
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, i);
}
```

### `chain-returning`

```
module Game;
function one(n: byte): void { poke($C100, n); }
function two(n: byte): void { poke($C100, n); }
function main(): void {
  let hook: fn(byte): void = &one;
  if (peek($C000) == 1) { hook = &two; }
  hook(7);
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, i);
}
```

### `single-target`

```
module Game;
function one(): void { poke($C100, 1); }
function main(): void {
  let hook: fn(): void = &one;
  hook();
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, i);
}
```

### `thunk-result`

```
module Game;
function one(): byte { return peek($C100); }
function two(): byte { return peek($C101); }
function main(): void {
  let hook: fn(): byte = &one;
  if (peek($C000) == 1) { hook = &two; }
  let v: byte = hook();
  v = v + peek($C003);
  poke($C102, v);
}
```
