# Interprocedural raw-write callable invalidation — execution plan

> **Owner**: issue [#161](https://github.com/blendsdk/blend65/issues/161), the interprocedural and
> borrowed-alias remainder of [#156](https://github.com/blendsdk/blend65/issues/156).
> **Dependency**: the validated direct byte-interval kill analysis from the #156 bounded slice.
> **Scope mode**: strict. No frozen `spec/` change, no new runtime, no new source restriction.

## Problem

The direct slice rejects a call after a same-body raw write. A raw write inside a helper can still
leave a stale callable proof:

```blend65
callback = &chosen;
corrupt();          // corrupt(): pokew(&callback, 0)
callback();         // must fail E10277
```

A borrowed aggregate parameter has the same problem:

```blend65
box.cb = &chosen;
corruptBox(box);    // corruptBox(p): pokew(&p.cb, 0)
box.cb();           // must fail E10277
```

Forwarded parameters, parameter–parameter and parameter–global aliases, finite indirect calls,
startup initializers and an unresolved runtime destination are the same class.

## Scope

**In scope**

- Per-function may-kill summaries over the existing `killFlow`, entry-independent and
  parameter-relative.
- Direct-call translation to the actual argument's byte interval, including borrowed aggregate
  fields and forwarded parameters.
- Call-site alias relations inside a callee: two parameters, or a parameter and a global, that
  receive overlapping actual byte intervals. A kill on one root is projected onto every assumed
  alias with its byte displacement, before any later read or nested call.
- Callee entry kills: the union, over every direct and finite indirect call site, of the caller's
  kills translated into the callee's parameter roots; global roots pass through.
- Finite indirect calls: the union over the settled provisional target set, translated identically.
- Ordered startup initializers: kills accumulate in schedule order and reach `main`.
- Translation expands each killed interval through the actual root's proved placement, so a
  borrowed write that physically crosses an adjacent placed callable is caught.
- Same-body restoration stays exact (`subtractStore`). Cross-call restoration of a whole bare
  callable global gets its own definite-store summary, independent of the #156
  address-taken/placement eligibility rule. Field-level restoration is
  [#157](https://github.com/blendsdk/blend65/issues/157), the next wave-1 item.
- Destination resolution tries, in order: the exact place interval; every possible interval of a
  checked or proved-bounded dynamic place; constant placed-overlap intervals; otherwise one
  conservative opaque kill.

**Out of scope, with named owners**

- Field-level caller-kill restoration through a helper: #157 (same wave, next).
- Bounded local index ranges that make more destinations resolvable: #163.
- A raw write inside an interrupt handler overlapping an asynchronous callable read: the interrupt
  ownership analysis remains the owner; this plan does not claim handler-domain coverage.
- A constant raw address that overlaps an *automatically placed* callable after layout: layout
  conflict proof is a separate post-layout obligation, recorded in this plan's residuals.

## Decision

Carry the existing byte-interval kill facts across calls.

1. **Local summary.** Run `killFlow` with an empty entry state and the callee's alias relation. The
   union of killed ranges at every returning block is the function's produced-kill summary. Because
   typed stores subtract only typed bytes, a helper that raw-writes and then re-assigns the callable
   has no residual range.
2. **Alias relation.** For every call site, resolve each borrowed actual to its possible byte
   intervals, expand them by the root's proved placement and by one maximum write width, and record
   a relation `{root, displacement}` for every overlapping pair. Add the symmetric relation. An
   unresolved or unbounded actual contributes an all-roots relation for that parameter. The callee
   analysis uses the union over all call sites; this is a call-boundary translation, not a general
   alias solver.
3. **Translation.** A summary range rooted at a callee parameter translates to every possible byte
   range of the corresponding actual, then expands through the actual root's placement. A range
   rooted at a global stays global-rooted. A by-value scalar argument never aliases. A borrowed
   origin that cannot be resolved becomes the opaque kill instead of being dropped.
4. **Entry kills.** At each call site the caller's kills are translated into the callee's parameter
   roots and unioned with the global-rooted kills. Callers are processed by a monotone worklist; the
   finite root × byte-interval domain guarantees termination, including any recursion left in the
   input before the recursion diagnostic runs.
5. **Indirect calls.** The provisional target set from the pre-poison target settle is an upper
   bound on the final set. Retain the unfiltered candidate roots from that settle — the published
   map's `UNKNOWN_TARGET` emptying is not the carry input. Applying every provisional target's
   summary only adds kills, so the result stays sound when the final set is smaller or empty.
6. **Restoration.** A dedicated definite-store analysis records the whole bare callable globals a
   function stores with a callable-safe value on every returning path, whichever declaration is
   address-taken or placed. After a call the update is `(incoming − definiteRestores) ∪
   producedKills`: a definite store restores kills that entered the callee, but it cannot erase a
   kill produced after that store. A helper that stores and then corrupts therefore still poisons
   the caller.
7. **Destination resolution.** `addRawWrite` first uses the exact place interval, then every possible
   interval of a checked or proved-bounded dynamic place, then constant placed overlaps. Only when
   none resolves does it return the opaque kill. `rangeIsKilled` treats the opaque kill as
   overlapping every root; a typed store cannot subtract it. The raw write itself always compiles.

No new diagnostic code is introduced; the call fails the existing `E10277`.

## Preflight resolutions

| Finding | Resolution |
| --- | --- |
| PA-201 / PA-301 — the existing definite-write summary excludes address-taken and placed globals, so the promised restoration is unavailable | Dedicated definite-store restoration summary with its own eligibility rule; address-taken and placed whole bare callable globals are included because the store writes their exact bytes with a callable-safe value. Conditional and restore-then-corrupt controls added. |
| PA-202 / PA-401 — kills are not projected onto parameter/global aliases inside a callee | Call-site alias relation with byte displacement, applied inside `killFlow`; covers parameter–parameter and parameter–global aliases in both directions, plus distinct-actual non-aliasing. |
| PA-203 / PA-501 — the opaque fallback would reject the existing bounded dynamic-index control | Destination resolution tries every possible interval of a checked or proved-bounded dynamic place before the opaque fallback; the existing `box.data[index]` control stays accepted. |
| PA-402 — a translated borrowed write that physically crosses an adjacent placed callable is missed | Translation and alias construction expand intervals through the actual root's proved placement; the borrowed version of the adjacent-object witness is an acceptance row. |
| PA-502 / PA-601 — the zero-cost claim has no measurement oracle, and store-then-corrupt could be hidden by the restoration order | Capture the accepted controls' PRG, code, zero-page and scratch bytes before the change, pin them, and re-measure after. Restoration is `(incoming − definiteRestores) ∪ producedKills`, so a store followed by corruption keeps the corruption. |
| Incoming kills through finite indirect calls | Provisional target superset from the pre-poison settle; union over all provisional targets; monotone kills. Final poisoned target sets may only shrink, which cannot unsoundly remove a kill. |
| Definite restoration across calls | Same-body restoration is exact; whole bare callable globals restore through the new definite-store summary; field-level caller-kill restoration is #157's acceptance, in the same wave, and #161 remains sound without it. |
| Runtime destinations forcing an unbounded scope | Precise resolution first; one conservative opaque kill only for a genuinely unresolvable destination. #163 owns further bounded-local recovery, and the issue's runtime-destination witness fails `E10277` as required. |

## Tasks

- [ ] T-161.1 Reproduce helper-kill, caller-kill/callee-read, borrowed-parameter, parameter–global,
      same-actual, distinct-actual, adjacent-placed, forwarded, singleton-indirect, transitive,
      startup, definite-restore and opaque-destination witnesses.
- [ ] T-161.2 Author the public specification oracle before implementation; confirm RED.
- [ ] T-161.3 Extend `raw-write-kills.ts` with the opaque sentinel, possible place intervals,
      displaced alias relations and placed expansion; keep the existing dynamic-index control green.
- [ ] T-161.4 Add `interprocedural-kills.ts`: entry-independent local summaries, alias-aware kill
      propagation, call-site translation, the monotone entry-kill worklist, the provisional
      indirect-target union, ordered startup transfer and the definite-restore subtraction.
- [ ] T-161.5 Integrate the new facts into `assignment-facts.ts` without changing the assignment
      semantics or the `UNKNOWN_TARGET` empty-set rule.
- [ ] T-161.6 Implementation tests for every witness, including distinct-actual non-aliasing,
      disjoint-field controls and the pinned accepted-output bytes.
- [ ] T-161.7 Independent review: correctness, semantics, SFA/ABI and emitted code.
- [ ] T-161.8 Complete `yarn test` and the wave `yarn test:full` checkpoint; closeout, roadmap and
      issue evidence. Keep the runtime-destination residual explicitly owned.

## Acceptance

| Area | Oracle |
| --- | --- |
| Callee kill → caller read | `callback = &chosen; corrupt(); callback()` fails `E10277`. |
| Caller kill → callee read | A direct callee reading `callback` after the caller's raw write fails `E10277`. |
| Borrowed parameter | `corruptBox(box); box.cb()` fails `E10277`. |
| Same actual twice | A callee that writes one borrowed parameter and reads a second fails when both actuals are the same object. |
| Parameter–global alias | A callee that writes a global and reads a borrowed parameter of it (and the reverse) fails. |
| Forwarded alias | `outer(box)` forwarding to `inner(x)` that writes `x` and reads it fails. |
| Adjacent placed actual | A byte write through a borrowed parameter that crosses into an adjacent placed callable invalidates that call. |
| Distinct actuals | `inspect(left); inspect(right); pokew(&left.cb, 0); right.cb()` builds. |
| Singleton indirect | A finite indirect call to a raw-writing function invalidates the later read. |
| Transitive | The same through a helper chain. |
| Startup | An un-restored initializer kill invalidates a later `main` read. |
| Disjoint field | A byte write to a non-callable field leaves the sibling callable accepted. |
| Definite restore | `pokew(&callback, 0); repair(); callback()` builds when `repair` stores `&chosen` on every returning path, including an address-taken or placed global. |
| Failed restore | A conditional restore, or a helper that stores and then corrupts again, still fails. |
| Bounded dynamic destination | `poke(&box.data[index], 0); box.cb()` builds with a checked or proved-bounded index. |
| Opaque destination | `poke(variableAddress, 0); callback()` fails; the same write with no later callable read builds. |
| Cost | Analysis-only; accepted controls keep their exact PRG, code, zero-page and scratch bytes. |
| Runtime destination precision | Bounded local indices remain #163's precision debt; no general alias solver, heap or runtime. |

## Residuals

| Residual | Owner |
| --- | --- |
| Field-level caller-kill restoration through a helper | #157 |
| Bounded local index ranges | #163 |
| Handler raw write overlapping an asynchronous callable read | interrupt ownership analysis |
| Constant address overlapping an automatically placed callable after layout | new post-layout conflict issue, filed at closeout |
| Alias precision across call sites with different actual objects | union relation, conservative by design; no context-sensitive clone |
| Runtime destination that stays unresolved | accepted AR-P1 boundary, now conservatively rejected after the write |

## Constraints

- `spec/` stays byte-identical; the ledger gains no row.
- No test, oracle or VICE journey is deleted, skipped or weakened.
- #156 stays open until this and the runtime-destination decision are resolved.
- No general alias solver, heap or runtime.
- No push. Commit at the verified checkpoint.
