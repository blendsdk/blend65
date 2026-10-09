# Task T-11: Prove local masked array indices without changing address semantics

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Progress**: 0/4 tasks (0%)
> **Last Updated**: 2026-10-09 14:10 CEST
> **Phase baseline**: `25533bc2c3d5143e41acbcf8b74082958216e42c`
> **Phase baseline tree**: `dfb47c03f071bc31f3930c05373f245a963f5077`
> **Scope mode**: strict

## Objective and authority

Close [keyboard AR-P8](../rd-05-keyboard-input/00-ambiguity-register.md#ar-p8--masked-saved-row-query-retains-cold-state):
an ordinary saved-row query using `rows[column & 7]` must not keep unrelated cold private
storage merely because the index is not a literal. The user replied “proceed” to this
named extension on 2026-10-09. The confirmed remaining-RD-05 effort waiver applies;
state each task's recommended effort without repeating confirmation stops.

**Smallest viable design:** Add one private, body-local nonnegative upper-bound query for
indexed places in the existing global selector. Reuse existing semantic definitions and
integer facts. Preserve the exact literal/conversion resolver used by raw memory addresses.
No general range, branch, loop or interprocedural solver; no new pass, public interface,
runtime check, library API, representation, dependency or acquisition implementation.

| Boundary         | Contract                                                                                                                                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning target  | T-11 under blend65-v4/RD-05; this one local proof correction                                                                                                                                                                                       |
| Context          | Keyboard AR-P8, completed source-library prerequisite, frozen integer/array/effect rules, existing selector and its direct whole-program/storage/layout consumers                                                                                  |
| Modification set | This mini-plan and its normal preflight/review evidence; keyboard register; feature roadmap; `packages/compiler/src/semantic/reachable-globals.ts`; one new internal test file; one blind new `test/rd05/source-library-masked-index.spec.test.ts` |
| Excluded         | Existing spec tests, `spec/`, expert skill, frontend types, SFA/ABI contracts, raw-address proof semantics, sibling requirements/plans, portfolio, keyboard acquisition and any optimizer framework                                                |

The prior diagnostic is an artifact observation, not proof of a complete keyboard API.
The broader keyboard positive gate remains blocked on its own technical closure.

## Local proof contract

1. An already resolved nonnegative literal gives an exact upper bound. Negative/unknown
   values remain unproved. Existing exact conversion semantics stay unchanged.
2. A binary `&` with a proved constant nonnegative mask on either operand gives the
   inclusive range `0..mask` only when the mask fits the operation's recorded 8/16-bit
   integer domain. An unsigned mask must fit that width; a signed mask must clear its
   sign bit. Missing integer facts, negative masks and sign-bit ambiguity remain unknown.
   The other operand need not be constant. This is containment, never exact-value folding.
3. Propagate that nonnegative bound through a conversion only when the entire bound fits
   the destination's recorded width and signed range: then every value is preserved.
   A conversion that could truncate or change sign remains unknown. Do not infer bounds
   through loads, calls, branches, arbitrary arithmetic or stored values.
4. Definitions and memoized results are local to one reachable body. Shared conversion
   tails must reuse results; traversal must be iterative, with cycles remaining unknown.
   Reuse one definition inventory rather than duplicating body scans. No host-stack recursion.
5. For each array selection require the bound to be below that exact extent. Accumulate
   its maximum byte displacement using the complete element stride and all field offsets.
   Check every nested extent and the final access width against both selected type and root
   size. Unknown/missing root type or any incomplete footprint retains candidates.
6. Only indexed-place containment consumes the new bound. Raw byte/word CPU accesses and
   VIC/CIA selector observers continue to consume exact literals. `poke(x & mask, value)`
   must never be treated as a write to exactly `mask`. Every original operation, effect,
   source identity, callable root, initializer and address dependency remains unchanged.
7. Eligible private storage omitted through this proof is omitted before existing reservation,
   SFA and platform-layout closure. No function storage is added after closure. Other retained
   globals and all storage/visibility/placement exclusions retain the prior contract.

Recorded runtime facts govern the proof, not a source declaration's width. Direct unbarriered
byte/sbyte index arithmetic promotes to word/sword; deliberate narrow barriers remain real.
This change supplies a memory-observer proof, not machine narrowing or a bounds-check removal.

## Independent acceptance cases

All source cases use existing public `checkProject`/`buildProject`, real ACME, optimization
`none`, and four cooperative PAL/NTSC × 6581/8580 PRG profiles. Reuse
`test/rd05/source-library-fixture.ts`; do not add a harness. New spec author remains blind
to production source, internal tests, dist, prior oracle answers and phase diffs.

| Case | Input → independent expectation                                                                                                                                                                                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ST-1 | Saved eight-row fixed-array borrow; dynamic byte/word index AND 7, both operand orders → cold acquisition function and its private byte absent                                                                                                                                                                                              |
| ST-2 | Signed input masked with a positive sign-clearing mask; explicit value-preserving narrow/widen conversion → same omission and correct saved-row selection                                                                                                                                                                                   |
| ST-3 | Mask zero, mask exactly extent minus one; packed struct field, nested arrays and word-sized elements → complete contained footprint omits only unrelated cold data                                                                                                                                                                          |
| ST-4 | Mask reaches/exceeds extent, unsigned-to-signed sign ambiguity, possible truncation, unmasked or unrelated arithmetic → conservative retention, no new diagnostic/runtime restriction                                                                                                                                                       |
| ST-5 | Dynamic masked raw read/write, including a possible ordinary RAM address and a VIC/CIA selector → retain cold data; never use a bound as an exact address                                                                                                                                                                                   |
| ST-6 | Literal/conversion-only controls and live/initialized/exported/placed/address-taken data → prior exact behavior and exclusions preserved; old immutable specs also rerun                                                                                                                                                                    |
| ST-7 | Real runtime saved-row lookup over all 256 byte patterns plus signed/high-word boundaries → values derived from independent bit/array semantics; one sequential VICE witness per profile; no acquisition MMIO or hidden runtime                                                                                                             |
| ST-8 | Equivalent control with no cold declaration versus the masked query with cold acquisition → identical emitted executable instructions, artifact payload and startup behavior; no added BSS/ZP/SFA/stack/scratch. Against the recorded pre-fix cold diagnostic, save exactly its one resident BSS byte; reconcile complete actual accounting |

Spec assertions derive from the accepted cold-cost and frozen language contracts, not an
expected helper shape. Existing unsafe indexed/raw/hardware witnesses stay immutable.
Runtime and artifact evidence are independent endpoints; no optimization differential alone
is a behavior oracle. An unsupported case is retained, not a source-language prohibition.

Internal hardening additionally covers all 8/16-bit signed/unsigned mask boundaries, both
operand orders, unsafe conversions, malformed/missing facts and root/path/width metadata,
shared chains, a deep conversion chain and cycles. Exercise the existing public selection
entry with real semantic objects, no arithmetic/proof mocks. Preserve semantic body references.

## Tasks

- [ ] T-11.1 [spec-author] Freeze the independent new source cases before any production edit; capture genuine red omissions and prepassing conservative controls, source hash and author provenance. Directed Verify: new spec file using the existing root Vitest command. Deliverable: one new immutable oracle plus red log; no old test edit.
- [ ] T-11.2 Implement only the local bound query and indexed consumer; preserve exact raw resolver semantics. Directed Verify: run `yarn build` first to refresh compiler package output, then new specs plus existing source-library raw/indexed/hardware suites. Deliverable: smallest production diff and green source evidence.
- [ ] T-11.3 Add the focused internal boundary/deep/shared/cycle and complete-footprint tests; capture complete actual assembly/artifact/resource costs and unchanged operations. Directed Verify: new and existing selector internals, all source-library specs, build and typecheck. Deliverable: focused internal suite and independent behavior/output evidence.
- [ ] T-11.4 Run full Linux verification and independent correctness, semantics, SFA/ABI, platform, output and host-performance reviews. Resolve findings within authority; record scope limits, preflight identity, deferral check and roadmap status; local green commit without pushing. Deliverable: verified complete bounded task, not an RD-05/keyboard closeout.

**Verify:** During tasks run directed Vitest tests. At the final checkpoint run
`yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn test`.
Public source tests import compiler package output; after each production edit, refresh it
with `yarn build` before directed root verification. Internal source tests do not replace
that public-output refresh.
VICE runs sequentially. Also validate touched formatting, local links, whitespace,
new oracle hash and empty frozen-authority guards. This is the existing approved project
verification rule, not a new verification tier. Use the git-commit skill locally; never push.

## Review and evidence boundaries

Risk: sensitive memory-observer proof. The configured six relevant roles assess distinct
contracts, in waves within four total agents. Only the primary runs expensive verification.
Correctness includes independent oracle integrity; the spec author cannot review its own oracle.
No new host-input/process boundary: separate security auditor is not applicable. Defensive
unknown-fact/invalid-footprint cases are mandatory. No artifact schema/version migration is made;
fresh existing build generations are independently reconciled as before.

Expert `2.0.4`, content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`;
`il-and-optimization.md#arithmetic-and-constant-evaluation`, `#memory-effects-and-volatility`,
`compiler-architecture.md#information-that-cannot-be-erased-early`;
source key `BLEND65-SPEC-4-038b70e9`. Governing frozen owners:
`spec/02-type-system.md` TS-3/4/9/20, `spec/04-expressions-operators.md` §3.5/3.6/4,
`spec/08-arrays-strings.md` AR-3/4/6, and `spec/11-memory-model.md` plus Chapter 12's
ordered memory intrinsics. No new C64 device semantics or interrupt route is introduced.
Physical hardware remains unverified. Existing output debt is not waived by a one-byte saving.

Before completion ask whether this task expired a deferral rationale. Its local mask proof
can settle AR-P8's diagnostic; it does not prove keyboard acquisition, electrical certainty,
NMI coordination, arbitrary indices or the separate T-10 callable assignment defect.
