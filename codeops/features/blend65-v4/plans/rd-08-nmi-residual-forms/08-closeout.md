# Closeout — RD-08 Residual NMI Forms

> **Parent**: [Index](00-index.md)
> **Issue**: [#150](https://github.com/blendsdk/blend65/issues/150)
> **Updated**: 2026-11-13
> **Result**: Delivered, 24/24 tasks; four-profile byte oracle and two sequential VICE cases pass;
> ledger row retired. Two local parity gaps are tracked by issues #151 and #152.

## 1. Delivered forms

| Form | Expert sequence | Handler bytes | Body path-max | `hardwareStack` |
|---|---|---:|---:|---:|
| `(w & 258) != 0` | `LDA W; LSR; ORA W+1; AND #1; STA` | 16 | 16 | 4 |
| `(w & 258) == 0` | same plus `EOR #1` | 18 | 18 | 4 |
| `(w & 258) == 258` | `LDA W; LSR; AND W+1; AND #1; STA` | 16 | 16 | 4 |
| `(w & 258) != 258` | same plus `EOR #1` | 18 | 18 | 4 |
| multi-bit word mask (e.g. `0x0303`) | `LDA W; AND #lo; BNE; LDA W+1; AND #hi; BEQ; LDA #1; STA` | 23 | 22 | 4 |
| multi-bit word constant (e.g. `0x0303 == 0x0303`) | `CMP #lo; BNE; LDA W+1; AND #hi; CMP #hi; BEQ; LDA #0; BEQ; LDA #1; STA` | 31 | 30 | 4 |
| high-byte-only mask (e.g. `w & 256`) | `LDA W+1; AND #hi; BEQ; LDA #1; STA` | 16 | 14 | 4 |
| `m = maskValue \| 1; (read & m) != 0` | `LDA mask; ORA #1; PHA; LDA ICR; TSX; AND $0101,X; BEQ; LDA #1; STA; PLA` | 29 | 31 | 6 |
| `(read & 8) == 8` | `LDA ICR; AND #8; BEQ; LDA #1; STA` | 16 | 14 | 4 |
| `(read & 3) == 1` | `LDA ICR; AND #3; EOR #1; BEQ; LDA #1; EOR #1; STA` | 20 | 18 | 4 |
| nine `peek` samples | `9×(LDA; PHA); TSX; 8×(LDA $010n,X; STA); PLA; STA; TXA; CLC; ADC #9; TAX; TXS` | 103 | 147 | 14 |
| sample across a join | `LDA ICR; PHA; LDA flag; BNE; …; TSX; LDA; STA; …; PLA; STA` | 36 | 35 | 6 |
| sample across a call | `LDA ICR; PHA; JSR; PLA; STA` | 15 | 21 | 7 |

`hardwareStack` includes the three-byte NMI frame, the wrapper's A/X saves, the body pushes and, for
the call form, the two-byte JSR return address. The last top-slot use is consumed with `PLA`; the
return pops one fewer byte. The call form needs no X save and no `TSX`.

The nine-sample and call sequences are the constrained expert result: the cooperative route has no
private RAM/zero-page home, so a hand-written routine must also push the values or spend X/Y plus
saves. The cross-join form is behaviorally correct but its per-path expert form is tracked by #152.

## 2. Expert comparison

| Form | Best legal expert | Compiler result |
|---|---|---|
| wide word `!= 0` / `== 0` | the aligned 12/16 body (or 14/18 inverse) | meets |
| wide word `== M` / `!= M` | the aligned AND 12/16 body (or 14/18 inverse) | meets |
| multi-bit word zero test | the same branch join (19 body bytes, 22 cycles) | meets |
| multi-bit word constant | the same per-byte `CMP` join (27 body bytes, 30 cycles) | meets |
| computed mask | the same `PHA`/`TSX`/`AND absolute,X` sequence (21 body bytes, 31 cycles) | meets |
| nonzero identity | the same bit-test branch (12 body bytes, 14 cycles) | meets |
| nonzero general byte | the same `EOR` and branch (16 body bytes, 18 cycles) | meets |
| nine samples | the same constrained push/pop sequence with the final `PLA` and bulk cleanup (95 body bytes, 147 cycles) | meets |
| call retention | the same `PHA`/`PLA` sequence (11 body bytes, 21 cycles) | meets |
| join retention | a per-path `PLA` and A merge (27 handler bytes, 28 cycles) — tracked by #152 | currently 36/35; tracked debt |

The wide and computed forms also beat the private-home variant on bytes; the private-home variant is
not a legal cooperative-NMI result. Every delivered form except the tracked cross-join (#152) is at
or below the best legal expert sequence.

Two local parity gaps remain tracked, both outside the delivered source forms' correctness:

- **Foldable impossible comparison** (#151): `(x & 14) == 3` still emits the general
  `AND/EOR/branch` sequence (20 handler / 16 body bytes, 18 cycles) where the expert folds to
  `LDA ICR; LDA #0; STA` (12 handler / 8 body bytes, 10 cycles).
- **Cross-join per-path consume** (#152): the join form is 36 bytes / 35 cycles / peak 6; the expert
  pops per arm, carries the sample in A and reaches 27 / 28 / peak 5. The current sequence is
  behaviorally correct but does not meet the expert.

## 3. Proofs

- **No private home.** The inventory omits every retained local before allocation. The machine
  lowering creates no temporary for the aligned word mask, the multi-bit join, the computed mask, or
  the nonzero comparisons. The existing `nmiPrivateStorageRoute` check is unchanged; the
  handler-private interval assertion finds no `sfa`, `zeroPage` or `scratch` owner.
- **Aligned word mask.** The selected low bit is shifted once (`LSR`) to the high byte's selected-bit
  position; `ORA`/`AND` combines the two selected bits; `AND #1` (plus normalization shifts for a
  non-zero position) yields 0/1. No two-byte object exists.
- **Multi-bit word mask.** The low masked byte is the only value in A; the high byte is reloaded from
  the addressable operand and consumed by the join.
- **Computed mask.** The mask is pushed once and consumed as `AND absolute,X`. The volatile read
  executes exactly once at its source point. The mask is not copied to RAM.
- **Nonzero comparison.** A single-bit mask equal to the constant is the inverted zero test; every
  other byte constant uses `EOR` (which leaves A=0 exactly on equality, so the shared zero-test
  splitter stays sound); a word constant uses one `CMP` per masked byte in the general join.
- **Retention plan.** Every retained store dominates every load of its binding and the single
  return; every pair of stores is dominance-comparable; no store is in a cycle; and no store that
  fails to dominate a load may reach it. Slots and per-block depths are seeded from that plan, so a
  join always sees the same live count.
- **Last-use consume.** A retained byte whose slot is the live top and whose actual last load in the
  single return block is a plain A consumer is consumed with `PLA`. The proof selects the actual
  last load, not the last consumable one, so a later bitwise use keeps the slot live. The depth
  drops by one and the return removes the remaining dead slots with a bulk `TXA/CLC/ADC/TAX/TXS`
  when X still holds the SP base. A right-hand bitwise operand is excluded because the other operand
  owns A.
- **Register validity.** `TSX` is reused within a proven run and re-read after a block entry, a push,
  a call or any instruction that defines X or S. A balanced call restores SP, so the slot address is
  unchanged at the load.
- **Wrapper.** The clobber analysis saves X whenever the body executes `TSX`; every body push is
  popped (or consumed) before the wrapper restores X and A.

## 4. Verification

| Check | Result |
|---|---|
| New four-profile spec oracle (`nmi-residual-forms.spec.test.ts`) | **77/77** |
| New sequential VICE oracle (`nmi-residual-forms-vice.spec.test.ts`) | **2/2** |
| Existing #149 retention oracle | Updated for the last-use consume (shared masked value and five samples now use a final `PLA`); 81/81 pass and both #149 VICE cases remain green. |
| Existing #148/#149 and route-admission oracles | Five-sample rejection became a positive retention probe (`nmi-source-read`), the exclusive CIA2 callback became positive, the exclusive nine-sample route became positive while the chained route stays `E10245`, the M1 placement padding refreshed 2924→2930, and the VICE profile-validation message was aligned with the runtime. |
| Ledger expiry (`expressiveness-ledger.spec.test.ts`) | **15/15**; five #150 probes build, the chained-route residual stays deferred (#153) |
| Machine and storage suites | **77 files / 954 tests pass** |
| New implementation tests | 14 machine + 6 plan + 19 retention-proof pass (39 focused) |
| Full compiler suite | **see §7** |
| Complete owned root suite | **see §7** |
| Build and typecheck | **see §7** |
| `spec/` | clean (`git status --porcelain spec/` empty) |

## 5. Runtime evidence

Both cases are genuine CIA2 Timer A NMIs through the stock KERNAL entry and return to the BASIC
caller at `$E147`. The two cases run sequentially.

| Case | Artifact SHA-256 | Handler | Peak | Observed |
|---|---|---|---:|---|
| materialization | `fa7a090777aa3133d05a635cc243b6d72f66e64150541e4615fb4b282e2fc936` | `2631–2671` | 4 | `ready=1`, `wide=1`, `bit=1` (general equality), `sourceBits=$09`, `w=$0002` |
| retention | `065997a2782c54d42b2913ba4ce2f41b9b51ab3b38baa1fb1e7c13a86c1e7a16` | `2631–2801` | 19 | `ready=1`, `out=$1B`, `marker=$5A`, outputs `$11..$1A` and `$1B`, inputs unchanged |

The tests assert the single ICR read, a selected post-acknowledgement store, the handler frame at
acceptance, the exact restore of A/X/Y/SP at RTI, the stock vector restoration, and the caller frame.

## 6. Ledger and residual boundary

The `v4-nmi-retained-source-reads` row is **retired**. All five probes build on every cooperative
profile, and the row records the delivered boundary. The address-taken local (`peek(&sample)`) still
needs a real home and still fails `E10245`. The stock chained-route retention is a separate deferred
row `v4-nmi-chained-retention` owned by issue #153.

Documented non-goals, not deferred work:

| Non-goal | Reason |
|---|---|
| A retained store inside a loop | It would push once per iteration; the stack proof requires a store that executes once. |
| The stock chained `setNMI` route's hardware-stack retention | The generated exclusive entry is the delivered frame contract; the chained route keeps its separate stock frame and E10245, tracked by #153 (ledger `v4-nmi-chained-retention`). |
| More than one return block with different live push counts | Each return would need its own pop count; the proof admits one return. |
| A handler whose call graph is not stack-balanced | The slot address relies on SP returning to the pre-call value. |
| A word-mask constant wider than sixteen bits | A word value cannot equal it. |

## 7. Final verification and review records

| Item | Evidence |
|---|---|
| Independent machine-code audit | MC-001 critical (`CMP` preserved A) fixed with `EOR`; MC-002 alignment and MC-004 last-use `PLA`/bulk cleanup delivered; MC-008 premature consume fixed (actual last load, not last consumable load); MC-009 high-bit normalization uses `ASL; LDA #0; ROL`; MC-003 impossible fold filed as #151; MC-005 cycle table corrected; MC-006 test constant made reachable. |
| Independent SFA/ABI audit | SF-001 cross-store reachability check added; SF-002 per-function plan keys and hard failure added; SF-003 zero-mask/nested constant folds and intervening effects handled; SF-004 peak claim softened; SF-005 premature consume fixed; SF-006 regression strengthened with a qualifying q load. |
| Independent platform audit | TP-001 fixed with the same `EOR` correction; TP-002 comments and closeout wording corrected. Stack 256−20=236, frame 3, wrapper saves, body pushes and JSR transient rechecked; evidence remains PAL/6581 `VICE-verified / hardware-unverified`. |
| Independent correctness review | Packet supplied; RV-001/RV-004/RV-007 fixed, RV-002 high-only general added, RV-003 default matrix and path oracle added, RV-011 labelled static, RV-005/RV-006 reconciled, RV-008 plan module split. Oracle authorship is disclosed as implementation-owner-authored rather than implementation-blind; the RED evidence is the pre-existing rejection oracles and the independent machine/SFA/platform audits. |
| Full compiler suite | **226 files / 3,808 passed / 2 skipped** (fresh run) |
| Complete owned root suite | **338 files**; the initial run passed 331 files and exposed 25 localized stale-oracle/golden failures. All 25 are fixed and their 12 affected files re-verified **262/262**; the 331 unaffected files passed in the same run. |
| Build and typecheck | **4/4 and 7/7** |
| `spec/` | clean |

The plan's `99-execution-plan.md` records the task timestamps. The historical 3,782-test count was
the pre-slice baseline; the fresh count includes the new implementation tests.

**Oracle provenance (disclosed process deviation).** The new `nmi-residual-forms.spec.test.ts`
oracle was authored by the implementation owner, not by an implementation-blind spec-test author;
the independent spec-test-author packet was blocked on fixture/API contracts and did not produce a
file. The RED evidence is the pre-existing rejection oracles, and the independent machine-code,
SFA/ABI and target-platform audits reviewed the delivered sequences and runtime witnesses. The
oracle's expected bytes and static path costs derive from the issue/expert sequences and the
documented NMOS table, not from compiler cost output. This is recorded as a process deviation, not
as a claim of independent authorship.

## 8. Deferral-expiry gate

Issue #150's work did not expire any other deferral's stated rationale. The retired NMI ledger row
was the only deferral that named the delivered forms as its landing place; it is closed. The four
documented non-goals are new extension boundaries, not deferrals with a landing slice. No new
user-hittable source form was left unowned: the word mask against a general nonzero constant was
included in this delivery, the impossible-constant fold is tracked by #151, the cross-join
per-path consume by #152, and the stock chained-route retention by #153, all with measured paths
to beat.

## 9. Commit and issue

The delivery commit and the issue close comment are recorded in the repository history. No push is
performed as part of this closeout.
