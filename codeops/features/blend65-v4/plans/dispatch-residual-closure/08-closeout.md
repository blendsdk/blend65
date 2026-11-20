# Dispatch residual closure — closeout

> **Owner**: T-36 / #170 · **CodeOps Artifact Schema**: 1
> **Status**: Complete · **Last Updated**: 2026-11-20
> **Plan**: [execution plan](99-execution-plan.md) · **Findings**: [05-findings.md](05-findings.md)

## What this unit set out to do, and what it actually delivered

Two residuals kept issue #170 open. Both are closed.

| Half | Before | After |
| --- | --- | --- |
| A | A dispatch whose every candidate never returns was **refused at zero arguments and accepted at one**, so the argument count decided whether a legal program compiled | Both compile. The thunk route applies the same non-returning test the comparison chain already applied |
| B | The machine refusal read `The machine storage binding stage is not complete for this program`, with `span = null`. No file, no line, no construct | `Machine flag proof did not complete for 'main' — the selected 'adc' has no proved producer for its decimal flag`, pointing at the exact addition, with a help line saying it is a compiler limitation rather than a bad line |

## What the evidence actually shows

| Claim | Evidence |
| --- | --- |
| The defect existed as described | Measured, not recalled: `thunk-nonreturning` refused in all four modes; `chain-nonreturning`, differing only by one unused parameter, built |
| Half A repaired it without moving output | Across 7 controls × 4 modes and all 7 examples, **exactly one measurement changed** — the refused program began building. The control that travels the changed path and already built is byte-identical |
| Half B moved no byte at all | The whole capture is identical to the half A measurement, before and after every review fix |
| The emitted shape is the expert one | `jsr` into the thunk, **no instruction after it**, the `jmp ($xxxx)` dispatch untouched, and the unreachable tail in its own block exactly as the chain already emits it |
| The tests are not vacuous | Both halves were reverted and watched failing: 27 of 80 for half A, 4 of 5 for half B's end-to-end cases |
| The frozen oracle was never touched | Blob `22e01e757bb305d770226f1a8280260b1ac31025` unchanged throughout; `git status` clean for `spec/` and every `.spec.test.ts` |

## The parts worth remembering

**The plan was wrong twice, and measurement caught both.** It claimed no currently-building program
could reach the changed path; a program with no post-call flag consumer builds today and travels it
exactly, so a control was added and measured. And it specified a defect finder whose capture points
would have let a false verdict return no defect — which, because the boolean is derived from the
finder, would have **accepted a malformed program**. Both were repaired before any code existed.

**The claim that no legal program could reach the refusal was refuted by this unit's own probe.**
That turned half B's acceptance from unit-level-only into a real end-to-end demonstration, and it
is why the diagnostic is proved on the program an author would actually hit.

**A ruling's phrasing excluded an axis, twice over.** The scope question was settled around the
five bind-error *producers*. A review then found four *consumers* that compute a witness and discard
it — invisible to the producer framing. Two were repaired; the issue owning the rest had its scope
explicitly widened to name consumers, so the same framing cannot lose it again.

**Two independent lenses converged on the same unfiled defect.** The machine-code and semantics
reviewers, with different briefs and no knowledge of each other, both found that a direct call to a
non-returning callee is refused, and both proposed the same remedy. That is now **#173**.

## Reviews

| Lens | Result |
| --- | --- |
| Half A correctness | 0 critical, 0 major, 3 minor — all fixed, capture re-run identical |
| Half A machine code | 0 critical, 0 major, 4 minor — the NMOS indirect-jump page hazard proved **triply guarded**, no padding introduced; parity debt recorded, not invented here |
| Half B correctness | 0 critical, **1 major** (the consumer axis) and 6 minor — all fixed |
| Half B semantics | 0 critical, **1 major** (already ruled and filed as #173), 4 minor — soundness **preserved**, verified on the ordering rather than on coverage |

One minor is an accepted residual with a stated reason: a call naming a bodiless function attributes
the defect to the absent callee and so resolves no span. Fixing it changes *which* construct is
reported, and this unit has measured its evidence against the current attribution; it belongs with
#174.

## Issues

| Issue | State |
| --- | --- |
| **#170** | **Closed by this unit** — both residuals repaired |
| **#173** | Filed: any call to a provably non-returning callee is refused when work follows it. The direct-call and single-candidate shapes remain, by ruling |
| **#174** | Filed, then widened: four bind-error producers still report no location, **and** two consumers discard a witness they already hold |
| **#171** | Closed against the commit that fixed it, with evidence posted |

## The closing gate

Run clean in one shot after every fix, at `5f6fe990`:

| Tier | Result |
| --- | --- |
| Compiler package | 260 files / **4,364 passed**, 2 skipped |
| Root host tier | 258 files / **5,472 passed** |
| CLI · language server · VS Code | 70 · 21 · 18 |
| Turbo tasks | 7 successful of 7 |

No failures and no retries. That also settles the two earlier intermittents below: the same corpus
on the same machine passes when it is not competing with a concurrent build.

Under the project's test-split policy no full `test:full` run was needed, because the unit's
containment argument is measured rather than asserted — across 7 control programs in 4 optimization
modes and all 7 examples, exactly one measurement changed in the entire unit.

## Disclosed rather than smoothed over

Two full gate runs each failed once, in different emulator-backed files, and each passed in
isolation and on sibling profiles. The second was an explicit timeout — 121,013 ms against a
120,000 ms budget on a case that costs about 60 seconds on a quiet machine. The pattern is neither
file: the host gate carries fixed per-test timeouts sized for a quiet machine and runs its files in
parallel, which makes a clean single-shot run load-dependent. That is a verification-policy matter,
not a compiler defect, and no third issue was filed for it because only two were authorised.

## Residual owners

| Residual | Owner |
| --- | --- |
| Non-returning direct and single-candidate calls | #173 |
| Remaining unlocated refusals, producers and consumers both | #174 |
| Expert tail dispatch — `jmp (ptr)` at the call site saves 3 bytes, 6 cycles and 2 stack bytes per site | Recorded in the findings; needs its own unit with a stack-peak model change |
| The unreachable continuation costs 37 real bytes, and the machine layer has no unreachable-block rule | Recorded; golden-shifting, so it needs its own oracle |
| Load-sensitive gate timeouts | Unowned pending a decision |
