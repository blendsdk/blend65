# Verification evidence

## Specification freeze — 2026-11-16

An independent implementation-blind author wrote three new files from the approved requirements
and signatures. The primary formatted them without semantic edits. Before freeze, the author
corrected a wide-read sampler that incorrectly expected capture immediately after the low-byte
load. It now preserves the specified ordered `LDA $D012; LDX $D013` core and both ordinary register
captures. No byte-only expectation or conservative guard was removed.

| File                                                                        | SHA-256                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/compiler/src/machine/sprite-publication-proof.spec.test.ts`       | `6f25be54c1a5fa7222ef93ad7d4fc21ef392d64de7ff1eed6555883c47f0a928` |
| `packages/compiler/src/machine/sprite-publication-eligibility.spec.test.ts` | `cd42455a0fa6f773fd79b8d2d7c9f3f7d4107a86b665df3c08588d441f87ca6e` |
| `test/rd05/sprite-publication-forwarding.spec.test.ts`                      | `0551d902540ae946befe8e0f168b7e35ec4bca40c0fa149957d366e6078f409c` |

| Command                                                                                                                                                          | Actual result before production code                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn workspace @blend65/compiler test src/machine/sprite-publication-proof.spec.test.ts src/machine/sprite-publication-eligibility.spec.test.ts --reporter=dot` | Two suites fail to import the not-yet-created helper. **Setup/API RED only; zero tests executed.**                                                                                                                                                                              |
| `yarn vitest run --config vitest.integration.config.ts test/rd05/sprite-publication-forwarding.spec.test.ts --reporter=dot`                                      | **8 meaningful RED / 24 pass**. Positive cases across four profiles and both polarities receive `AD 12 D0 8D 34 24 AD` instead of the seven-byte EOR/branch poll. All conservative controls, including the qualified wide-read adapter, pass. 8.52 s test time / 11.76 s total. |

The parent's nine-case meaningful poll RED and unchanged source/startup/frame oracles are recorded
in [parent evidence](../boing-ball-parity/08-evidence.md). Their expectations remain frozen. No
support implementation or GREEN claim existed at this freeze. Generated IRQ writers, named/aggregate
guards and host scale controls remain required implementation hardening, not waived coverage.

## Counter query

`yarn workspace @blend65/compiler test src/machine/sprite-publication-proof.spec.test.ts --reporter=verbose`
passes **7/7**. This includes both update directions, unchanged cycles, the transient four,
unguarded underflow, the frame-nine path, stale comparisons, unreachable predecessors, aliases
and actual load-object identity. After targeted formatting, `yarn workspace @blend65/compiler build`
passes. The counter query is not wired into emitted code yet; no poll GREEN is claimed.

## Asset publication and observer interface

`yarn workspace @blend65/compiler test src/machine/byte-capture-observers.impl.test.ts src/machine/lower-captured-byte.impl.test.ts src/machine/sprite-publication-proof.spec.test.ts src/machine/sprite-publication-eligibility.spec.test.ts --reporter=dot`
passes **4 files / 57 tests**. The 27 eligibility cases include all four profiles, complete asset
containment, initialized slots, unsupported pointers/aliases/selectors and stale program/source/write
identities. Existing observer/captured-byte controls pass unchanged. Compiler build and targeted
formatting pass. No emitted poll improvement is claimed at this interface-only stage.

## Anonymous comparison consumer

| Executed command                                                                                                                                                                                   | Result                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `yarn vitest run --config vitest.integration.config.ts test/rd05/sprite-publication-forwarding.spec.test.ts test/rd05/volatile-byte-poll.spec.test.ts --reporter=dot`                              | **41/41 pass**, including all 24 conservative controls.                                                           |
| `yarn vitest run --config vitest.vice.config.ts test/rd05/boing-ball-startup.spec.test.ts test/rd05/boing-ball-contract-vice.spec.test.ts test/rd05/boing-ball-parity.spec.test.ts --reporter=dot` | **3 files / 5 pass**, 59.04 s test time; unchanged source-derived trace/startup/state and original comparison.    |
| `yarn vitest run --config vitest.integration.config.ts test/rd05/boing-ball-parity-cost.impl.test.ts --reporter=dot`                                                                               | **1/1 pass** after the measured downward compiler code pin, 1,599→1,593. All other current pins remain unchanged. |

The ordinary operation materialization inventory includes operands to a terminal comparison; only
the comparison result's materialization is a barrier here. Complete operation and terminator use
counts separately exclude any extra producer or condition use. The consumer retains EOR and the
original read; only the six-byte store/reload pair disappears. Nominal taken poll cost is nine
cycles; IRQ service and VIC DMA remain outside this local cost. Review/hardening and the complete
phase checkpoint are pending. This is a bounded improvement, not whole-program parity.

## Hardening and independent review corrections

The first complete compiler regression run passed **239 files / 3,985 tests / 2 skipped** before
TP-001 and PE-001/002 corrections. It is not post-fix complete-checkpoint evidence.

After the necessary fixes, the directed command below passes **6 files / 79 tests**:

`yarn workspace @blend65/compiler test src/machine/sprite-publication-proof.spec.test.ts src/machine/sprite-publication-eligibility.spec.test.ts src/machine/sprite-publication-proof.impl.test.ts src/machine/sprite-publication-scaling.impl.test.ts src/machine/byte-capture-observers.impl.test.ts src/machine/lower-captured-byte.impl.test.ts --reporter=dot`

The 20 implementation controls include firmware-workspace writes with and without publication,
CIA registers/mirrors/crossing widths, generated IRQ writers, named/aggregate cases and stale
decrement operands. Two controls demonstrated the firmware admission hole before the fix; this is
not a reproduced firmware miscompile. Scale controls cover an 8,000-operation chain, a 600-root
conditional CFG and a 500-predecessor / 5,000-load suffix with exactly two visits per operation.

Post-fix public command adds the cost test to the two frozen output suites and passes **42/42**:
`yarn vitest run --config vitest.integration.config.ts test/rd05/sprite-publication-forwarding.spec.test.ts test/rd05/volatile-byte-poll.spec.test.ts test/rd05/boing-ball-parity-cost.impl.test.ts --reporter=dot`.

All six independent review lenses clear; platform/performance/semantics fix reviews clear the
necessary corrections. See [findings](05-findings.md). No frozen specification has changed.

`yarn install --frozen-lockfile`, `yarn build` and `yarn typecheck` pass. `yarn test:changed --host`
passes, including **246 root host files / 5,153 tests**, exit zero. The final sequential checkpoint
is running `yarn test` and then `yarn test:full`; the second starts only if the first passes.
The first `yarn test` exited zero: compiler **240 files / 3,995 passed / 2 skipped**;
CLI **10/70**, language server **5/21**, VS Code **5/18**; root host **246/5,153**. Total 566.55 s.
The subsequent actual `yarn test:full` also exited zero in **5,101.66 s**. Its root host tier passes
**246 files / 5,153 tests** and serialized VICE passes **130 files / 2,379 tests**, with **1 file /
4 tests skipped** under the existing suite policy. Owned workspace gates pass; Turbo may replay
unchanged host results, while the serialized runtime tier executes through the full command.
Owned logs: `/tmp/opencode/codeops/runtime-91b62a9d-8e6b-4802-bbb4-e3736b245244/issue168-checkpoint-4w52npr8/`.
The wrapper has finished; these owned logs are removed after this evidence is persisted, before
the local checkpoint is reported. This is a complete green run, unlike the historical failing
collision run followed by an isolated pass. The temporary reviewer artifact snapshot was removed after review; no denied read was
retried. Compiler poll `$0AB4` is inferred from the primary-read assembly ending at `$0ABB`, while
the executed byte/page oracle supplies actual local byte verification, not independent artifact
inspection by the auditor. Whole-path timing and physical hardware remain unverified.

## Scoped deferral-expiry assessment

**Did this unit's deliverables expire any deferral's stated rationale?** The missing bounded
publication proof named by parent PF-001 is now implemented, directed-verified and independently
reviewed. The complete checkpoint has now succeeded, so that bounded blocker closes. This
does not expire observation restrictions for unsupported programs or close the parent parity issue.

| Register / boundary examined                             | Assessment and continuing owner                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Child ambiguity register AR-1–AR-10, runtime AR-P11/12   | No unresolved or orphaned deferral. Broader state/interval/interprocedural analysis remains outside approval, not an automatic successor of this helper.                                                                                                                                   |
| Parent PF-001 and later-unit boundary                    | The bounded missing-proof rationale is discharged by this delivery, conditional on the complete gate. Remaining code allocation/control-flow/startup work remains #168; the independently preflighted dead-teardown mini-plan owns the next unit, not an implicit extension of this child. |
| RD-08 “Won't Have”, lines 405–422                        | No reason expires: no fifth mode, optional `none` search, public rule/plugin API, general pass framework, runtime, game engine or new language surface was needed.                                                                                                                         |
| Frozen future considerations FUT-006/007/011/012/015/016 | No new label/range syntax, object-link ABI, copy-pattern recognition, image conversion or stack-free calling evidence. Correcting the twin's nonreturning JSR is not a stack-free compiler ABI.                                                                                            |
| FUT-017, lines 378–399                                   | No cross-statement scheduling/reordering or new ordering primitive. Existing effects retain their contract.                                                                                                                                                                                |
| FUT-018, lines 403–418                                   | Full-window disjointness protects a private capture; it does not classify PEEK as nonvolatile or remove/reorder that read. No separate volatile API or relaxed RAM observation contract is justified.                                                                                      |

The 1,151-byte equal-contract code gap and unmeasured steady-state cycle parity remain due now
under #168, not deferred to an unnamed future slice. The next unit deliberately leaves entry
snapshots unchanged; it cannot claim to solve those costs. No frozen requirement/specification,
expressiveness entry or unrelated backlog row is changed by this scoped assessment.
