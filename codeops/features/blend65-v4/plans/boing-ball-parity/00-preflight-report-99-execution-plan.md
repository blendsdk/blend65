# Preflight: boing-ball parity execution plan

> **Status**: PASSED — PF-001 resolved by the independently qualified bounded child
> **Iteration**: 1
> **Audit target**: `99-execution-plan.md`
> **Audited SHA-256**: `efb1e7685158e250ebc37d3211136b829afdcffa280f9762fe6bdd8ce089bd8a`
> **Last Updated**: 2026-11-16

The target was authored in this session. Five independent clustered reviewers audited all
thirteen dimensions; a separate independent challenge checked the surviving major finding.
The primary merged findings and changed only the target's readiness boundary, not its semantics.
The target was subsequently amended to make the compiler blocker explicit; that amendment is not
an overall passing re-scan. The already-authorized twin repair is unaffected by the missing compiler
proof and may proceed after its new specifications demonstrate RED.

## Codebase context

TypeScript compiler, public project build services, ACME assembly and existing serialized VICE
fixtures. The current poll uses direct volatile-read lowering followed by machine retention and
ordinary EOR comparison. A selector can suppress retention, so its enabling proof must be complete
before that decision. Source sprite-pointer/enable writes are persistent hardware publications.

Context, not audit targets: the boing-ball source/twin/tests; `lower-register-forwarding.ts`,
`lower-function.ts`, `lower-operation.ts`, `lower-state.ts`, `lower-comparison.ts`,
`byte-capture-observers.ts`, `aggregate-place-proof.ts`, storage closure, manifests and the prior
returned-local observer ruling. No sibling plan or implementation receives a passing verdict.

## Coverage

| Cluster   | Dimensions                                                       | Result                  |
| --------- | ---------------------------------------------------------------- | ----------------------- |
| Soundness | 1 Ambiguities; 3 Logical Contradictions; 12 Consistency          | No findings             |
| Grounding | 2 Implicit Assumptions; 13 Codebase Alignment, all ten subchecks | PF-001                  |
| Delivery  | 4 Completeness; 5 Dependencies; 11 Ordering                      | No findings             |
| Risk      | 8 Security; 9 Edge Cases; 6 Feasibility                          | PF-001, same root cause |
| Fit       | 7 Testability; 10 Scope Creep                                    | No findings             |

## PF-001 — anonymous poll capture lacks an admitted observer proof — MAJOR

**Target location:** original lines 36–41, 54, 76–77.

**Evidence:** `packages/compiler/src/machine/byte-capture-observers.ts:89–103` rejects
hardware-RAM publication. `packages/compiler/src/semantic/aggregate-place-proof.ts:330–349`
classifies sprite-pointer and sprite-enable writes as publication; the workload contains both at
`examples/boing-ball/src/main.blend:97–102,152–155`. The existing comparison-reload adapter at
`byte-capture-observers.ts:148–166` also requires a named source `store`, whereas this poll's
retention home is compiler-generated. `lower-state.ts:680–687` can omit retention without calling
that observer predicate, so extending the selector alone would not prove the required boundary.

**Refutation:** the prior returned-local AR-6 ruling excludes incidental unpublished private
bitmap traces but explicitly preserves persistent source-publication guards. It cannot silently
authorize treating all anonymous captures as unobservable. Existing neighboring forwarding is
implementation evidence, not governing semantic authority.

**Recommendation:** keep the compiler task blocked. Establish a precise existing-seam proof for
the anonymous capture, or obtain an exact user-owned observer-contract ruling before changing
eligibility. A complete new fetch analysis is not presumed available or authorized; it would need
its own bounded design and complexity gate if material. Keeping the store can improve only to
10 bytes / 13 nominal cycles and cannot satisfy the seven-byte acceptance criterion.

**Initial disposition:** open, not waived. AR-P1 authorized only the named benchmark correction.
The later exact AR-P3 support approval and qualified delivery below resolve the missing proof;
they do not authorize an observer-contract change.

Confidence: high in the missing proof. Hardening: the independent follow-up challenge narrowed the
earlier A-only recommendation; register/flag safety alone is insufficient. Challenger: converged.

## Evidence scope

All review conclusions are read-only source assessments, not execution qualification. The primary
fresh baseline cost test passes 1/1 at 1,599 compiler code bytes / 402 non-equivalent twin bytes.
The first new poll specification run produces 9/9 meaningful RED cases: the instruction after
the raster LDA is STA (`$8D`) instead of EOR/CMP. The first VICE run passes the compiled startup
positive control and exposes the twin's missing startup and wrong application write trace. An
application trace adapter initially included retained-firmware CPU-port traffic; the independent
author corrected that sampler before oracle freeze. No behavior assertion was removed.

Expert lineage and governing source keys are recorded in the target. No physical-hardware claim,
whole-program parity claim, overall passing preflight or green compiler checkpoint follows.

## PF-001 reserved complexity decision — approved planning boundary

**Original goal:** deliver #168's preserved behavior, decreasing costs and seven-byte / nine-cycle
raster poll; qualify equal-contract expert output without weakening canonical `none`.

**Extra system or support code:** a bounded asset-relative sprite-publication eligibility proof
in the existing observer and guarded-fact seams, plus at most one focused asset-provenance query.
This would distinguish proven immutable asset fetches from unproved hardware publication; it is
not currently implemented or approved.

**Why it may be needed:** the current publication veto rejects boing-ball before forwarding can
be justified. A register-only anonymous value does not itself prove that removing its former RAM
traffic preserves source-selected display data or explicit raw-read values.

**Evidence:** the finding above; `guarded-place-proof.ts:5–13,29–44,62–68,189–213,291–318`
provides a converging maxima/identity query, not the necessary full frame invariant. The actual
workload has increment/reset, guarded decrement, unchanged iterations and `frame * 4` at
`main.blend:123–155`. `lower-c64.ts:454–484` supplies an asset-relative VIC-field seam; layout
places assets and SFA storage through conflict-checked intervals in
`c64-layout.ts:522–525,723–734`.

**Smallest solution that still works:** first prove `0 <= frame < 4` at each publication, including
initialization, both direction arms and unchanged iterations. Tie every potentially enabled
sprite's complete 64-byte fetch to the exact immutable asset. Keep existing guards for unknown
numeric pointers, wraps, raw/indexed reads, aliases, calls, asynchronous changes and unproved
screen/bank/mode/CPU-port writes, including mirrors and initializers. Reuse existing convergence
machinery and structural asset/SFA disjointness; no provisional-address shortcut or named-home
observer relaxation. Approval requires a standalone plan and passing preflight before support
implementation. If broader loop, path-state or interprocedural modelling is needed, stop again.

**Extra cost:** planning estimate only: two or three production modules, roughly 250–450 lines,
two or three focused test files, independent reviews and the scheduled complete checkpoint.
No new IR, optimizer pass, general machine-state engine, runtime, dependency, framework or
`none` candidate search. The line estimate is not a demonstrated feasibility result.

**Independent verdict:** **Justified**, confidence medium. The independent challenger recommends
bounded proof planning, not implementation yet. Existing convergence machinery is reusable, but
its current facts do not establish the reverse-frame recurrence or the unchanged-iteration case.
The enforceable abandonment boundary is essential. A contract clarification alone supplies no
missing proof. Retaining the store reaches only 10 bytes / 13 nominal cycles and fails acceptance.

**Direct user decision:** on 2026-11-16 the user selected **Approve proof (Recommended)** for
this exact bounded support surface, conditional on a standalone plan proving feasibility and
passing preflight before implementation. The approval expressly excludes a general hardware-state
analyser, relaxed observation rules, a new runtime/framework, `none` policy changes and broader
analysis. If the frame/publication invariant cannot be proved within this boundary, stop rather
than expand it. AR-P1 remains a separate benchmark-only approval. Approval does not itself resolve
PF-001's missing proof; the new support plan owns that delivery.

## Qualification follow-up — PF-001 resolved

The [standalone proof](../boing-ball-publication-proof/00-index.md) passed its own preflight,
independent specification-first RED/GREEN, six independent review lenses and the actual complete
checkpoint. Runtime TP-001 and PE-001/002 corrections were independently fix-reviewed. The final
`yarn test:full` exited zero in 5,101.66 s: host 246 files/5,153 tests; serialized VICE 130 passed
files plus 1 skipped, 2,379 passed tests plus 4 skipped. No isolated rerun is used as a substitute.

Mandatory certification covers even programs without publications. Unproved low-RAM/CIA routing,
aliases, calls, initializers and stale associations retain ordinary lowering; existing named-source
guards remain unchanged. The actual EOR poll is seven bytes/nine nominal taken cycles. Canonical
code decreases 1,599→1,593; equal-contract twin is 442, not the historical non-equivalent 402.

This resolves the only original blocking finding and permits closeout of the first bounded unit.
It is not a passing audit of later allocation/startup units or whole-program parity. The next
dead-teardown mini-plan has separate preflight and predecessor-commit gates.
