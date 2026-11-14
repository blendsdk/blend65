# Partial array construction and helper callable proof — execution plan

> **Owner**: v4 correctness debt rows T-15 (partial array construction) and T-10
> (finite callable assignment through a helper).
> **Scope mode**: strict. No frozen `spec/` change, no source-language restriction, no new
> runtime, no public API change, and no oracle weakened.

## Goal

Deliver the two remaining v4 expressiveness defects as one verified batch:

1. **T-15** — a mutable fixed array with fewer initializers than its extent is legal source.
   It warns `W10140`, initializes only the supplied elements, and leaves the omitted elements
   indeterminate. The current lowering rejects it with
   `COMPILER_LOWERING: Fixed array construction is missing an element`.
2. **T-10** — a callable global assigned inside an ordinary helper that runs before the call
   is a finite, provable target set. The current analysis does not transfer a callee's definite
   writes back into the caller's assignment facts, so
   `prepare() { callback = &chosen; }` followed by `invoke() { return callback(); }` fails
   `E10277`.

Both are baseline expressiveness defects, not hardware or SFA limits. Frozen Specification 4
already defines the required behavior.

## Grounded authority

| Question | Frozen authority | Decision |
| --- | --- | --- |
| Omitted array elements | `spec/08-arrays-strings.md` §W10140; `spec/evaluations/F014-arrays.md` Group A | Supplied elements are initialized; omitted elements "retain indeterminate stored bits". No zero fill is invented. |
| Callable target sets | `spec/06-functions.md` §4.3; `spec/evaluations/F018-functions.md` target-set boundary | Typed flow is tracked through assignments and calls. A finite set feeds effects, recursion, stack, interrupt overlap and SFA. `E10277` remains for an unproved callable read. |
| Definite writes | `spec/03-variables.md` definite-initialization contract | A call that definitely assigns a global makes it initialized after the call returns on every path. |
| Partial callable arrays | `spec/06-functions.md` §4.3; `spec/08-arrays-strings.md` callable element types | An omitted callable element has indeterminate bytes, so it cannot contribute a finite target. A partial array that omits any callable element keeps the merged index path unknown; a fully supplied or filled callable array stays provable. |
| Cost | Prime Directive | A singleton target stays eligible for a direct call; omitted elements emit no store; no new scratch, ZP or runtime. |

## Tasks

- [x] T-30.1 Rebuild the workspace before any public reproduction, then reproduce both defects
      from public CLI builds and record the exact diagnostics (`COMPILER_LOWERING` for
      `byte[2] = [7]`, `E10277` for the helper assignment). Public tests resolve the compiler
      `dist` output, so stale output must never stand in for baseline evidence.
- [x] T-30.2 Author independent specification tests before touching the implementation:
      `test/rd04/partial-array-construction.spec.test.ts` and
      `test/rd05/callable-helper-assignment.spec.test.ts`, including the interaction case
      `let callbacks: (fn(): void)[2] = [&chosen]; callbacks[1]();` (must fail `E10277`) and a
      fully supplied callable-array contrast (must build). Confirm every case is RED for the
      recorded defect, not for an unrelated syntax or profile error.
- [x] T-30.3 T-15 lowering. Make fixed-array member expansion emit one write per supplied
      element or fill value and skip omitted elements. The omitted bytes keep their previous
      stored bits; no fill, no helper and no runtime are added. Keep the existing
      more-elements-than-extent rejection. Aggregate target propagation must mark the merged
      index path unknown when a partial array omits a callable leaf, so T-15 cannot create a
      false finite call proof for an uninitialized element.
- [x] T-30.4 T-10 call proof. Add an entry-independent summary of the **bare callable globals**
      each function definitely writes on every returning path, including writes made by functions
      it directly calls. A transferable global has a `fn(...)` type, no placement constraint and
      no taken address. Feed the summary into both must-assignment consumers: entry-fact
      propagation and unknown-read collection. Aggregate fields, placed globals and address-taken
      storage keep the pre-existing conservative proof (issues #156 and #157). Indirect calls
      contribute no guarantee; an unproved route, an early return before the write, a write after
      the call, or one unassigning caller still fails `E10277`.
- [x] T-30.5 Implementation tests. Prove the exact emitted behavior: one store for the supplied
      element and none for the omitted element; fill still covers every element; a transitive
      helper assignment is accepted; an early return before the write, a write after the call, a
      conditional assignment and two call sites where only one assigns are still rejected;
      singleton devirtualization remains a direct call.
- [x] T-30.6 Independent review. Correctness, semantics, SFA/ABI and emitted-code lenses review
      the final diff. A critical or major finding stops delivery until fixed and re-reviewed.
- [x] T-30.7 Verification. Run `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`,
      the directed package and root tests including the affected VICE files, then `yarn test` and
      the complete serialized `yarn test:full` checkpoint because the call proof feeds SFA and
      interrupt overlap. Rebuild the workspace after every compiler edit before public reruns.
- [x] T-30.8 Closeout. Record evidence, mark T-15/T-10 done in the roadmap, run the
      deferral-expiry question, confirm `spec/` and the expressiveness ledger are untouched,
      and commit the verified checkpoint.

## Acceptance

| Area | Oracle |
| --- | --- |
| Partial local array | `let a: byte[2] = [7];` builds with `W10140`; `a[0]` observed as 7 on all four profiles. |
| Partial global array | `let g: byte[2] = [7];` runs its startup initializer and publishes 7 for element 0. |
| Omitted element cost | The construction emits no store for an omitted element; no zero fill is introduced. |
| Fill contrast | `[7; 0]` still writes every element and existing fill cases are unchanged. |
| Helper assignment | `prepare()` then `invoke()` builds and returns the exact helper value on all four profiles. |
| Proof soundness | A conditional assignment, an unproved read, and an erased raw boundary still fail `E10277`. |
| Partial callable array | Omitting any callable element fails `E10277` for an omitted or dynamically selected element; a fully supplied callable array still builds. |
| Multi-caller facts | A helper called on only one branch does not make the callable definite on the other branch. |
| Bounded transfer | Only a bare callable global with no placement and no taken address receives the new guarantee; aggregate fields, placed globals and raw-aliased storage still reject (issues #156/#157). |
| Cost and ABI | A singleton target remains a direct call; no new ZP, stack or scratch bytes are charged. |
| Regression | Existing pinned artifacts, function-target suites, array suites and the complete checkpoint stay green. |

## Constraints

- `spec/` stays byte-identical; the expert baseline and its qualification record are not edited.
- No test, oracle or VICE journey is deleted, skipped or weakened.
- The expressiveness ledger gains no new deferred row and loses no existing row: the defect was
  never recorded there, so delivery must not invent a ledger edit.
- Compiler package source is the only production surface changed.
- No general solver, per-index callable proof redesign or new runtime is added.
- The new call/startup transfer is limited to bare callable globals. Wider aggregate-field and
  placed-storage transfer stays with the tracked callable-proof debt.
- No push. Commit at the verified checkpoint.

## Review record

| Lens | Verdict | Evidence |
| --- | --- | --- |
| Correctness | APPROVE within AR-P1 | Destination-wide exclusion, direct-source predicate, overwrite coverage, oracle integrity; packet minor corrected. |
| Semantics | APPROVE within AR-P1 | Canonical/transitive/startup helper forms, partial arrays and ledger preserved; #156 is an accepted risk, not safe rejection; #157 is conservative precision debt. |
| SFA/ABI | APPROVE within AR-P1 | No false call edge inside the ruled boundary; zero target storage, ZP, scratch, stack or ABI fields. |
| Emitted code | APPROVE on output dispositions | Construction 5 B / 6 cycles; direct `JSR chosen`; #154/#155/#124 own the surrounding output debt; no existing-program regression found. |

AR-P1 is recorded in [00-ambiguity-register.md](00-ambiguity-register.md): the user selected the
bounded typed-provenance transfer on 2026-11-14. The closeout must state that #156 can still
invalidate a callable proof and produce incorrect output; it is an accepted risk, not a safe
rejection.
