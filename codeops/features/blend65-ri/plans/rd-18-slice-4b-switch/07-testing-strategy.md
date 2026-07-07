# 07 — Testing Strategy (Specification Test Cases)

Specification-first: every `ST-*` below derives from the frozen spec (`05-...§8`, `F009`), the FRs in
`01-requirements.md`, or an AR — **never** from reading the implementation. Spec tests are written
**red first**, then made green. Impl tests (internals/edge cases) are added after green.
`*.spec.test.ts` = spec tier; `*.impl.test.ts` = impl tier.

## Phase 1 — Semantics (`@blend65/frontend`, via the frontend barrel `compile()`/`analyze`)

| ST | Input (essence) | Expected | Trace |
|----|-----------------|----------|-------|
| ST-1 | `switch (b)` where `b: bool`, with a `default` | **E10075**, `hasErrors`, no throw | FR-1, AR-2 |
| ST-2 | `switch (x)` where `x: byte`, cases `1`/`2`, `default` | no error; discriminant + case values typed | FR-1, AR-11 |
| ST-3 | `case y:` where `y` is a runtime var | **E10071** | FR-2, AR-10 |
| ST-4a | `switch (x: byte) { case 300: ... }` (integer const out of `byte` range) | **E10084** (range, *not* E10077) | FR-3a, PF-002 |
| ST-4b | a case value whose folded type is a **non-adapting** different primitive vs the discriminant | **E10077** — **but see note** | FR-3, AR-4, PF-002 |

> **ST-4b note (PF-002).** In the **integer-only** 4b surface there is likely **no reachable input**
> that emits E10077: `evalConst` folds only numeric/bool literals, a `bool` value is caught first by
> **E10071** (not-an-integer-const), and integer literals adapt to the discriminant (or range-error →
> E10084). So E10077 is registered + wired but its emission is **exercised only from Slice 7** (enum /
> other-primitive constants). Author ST-4b as a **deferred/`.todo`** spec test (documenting the intended
> trigger) rather than a live green assertion, and add an **impl** test asserting the *precedence* — a
> `bool` case value yields E10071 (not E10077), `case 300`/byte yields E10084 (not E10077).
| ST-5a | `case 1, 1:` (dup within a multi-value list) | **E10132** | FR-4, AR-8 |
| ST-5b | `case 1: ... case 1: ...` (dup across clauses) | **E10132** | FR-4, AR-8 |
| ST-6 | `fallthrough;` followed by another statement in a case body | **E10074** | FR-6, AR-7 |
| ST-7 | `fallthrough;` inside an `if {}` within a case body | **E10074** | FR-6, AR-7 |
| ST-8 | `fallthrough;` as the last statement of the `default` clause | **E10073** *warning* (not error) | FR-7, AR-3 |
| ST-9 | a `let z: byte` declared inside a case body | `z` collected into the function frame (SFA slot; no E10100 on a later ref) | FR-8, AR-12 |
| ST-10 | `break;` inside a `switch` inside a `while` | accepted (targets the loop; no E10130) | FR-9, AR-6 |
| ST-11 | two `default:` clauses in one switch | **no error** — the parser silently keeps the **last** `default` (last-wins); a semantics E10076 is unreachable, so 4b accepts it. Asserts the *actual* current behavior. (E10076 deferred parser-owned.) | FR-5, PF-001 |

## Phase 2 — Lowering (`@blend65/codegen`, IL-level + `translate`)

| ST | Input | Expected | Trace |
|----|-------|----------|-------|
| ST-12 | lower a 2-case + default switch | a multi-block `ILFunction`: dispatch test blocks with `brcond`, one body block per clause, a join block | FR-10, AR-1 |
| ST-13 | `case 2, 3:` (multi-value) | two `eq`+`brcond` tests, both true-edges → the **same** body label | FR-10, AR-8 |
| ST-14 | a case body ending in `fallthrough` | that body terminates `br(<next clause body>)`, **not** `br(join)` | FR-11, AR-9 |
| ST-15 | a case body with no `fallthrough` | terminates `br(join)` (auto-break) | FR-11, AR-9 |
| ST-16 | the dispatch chain's final false-edge | unconditional `br(<default body>)` | FR-10, AR-5 |
| ST-17 | translate the switch IL to Instr | assembles with **no** new terminator kind; the `eq` sequence uses the DEF-1-corrected form | AR-1, AR-13 |
| ST-18 | the **unchanged** `unsupportedFixture` (bare `fallthrough`, still unsupported post-4b) | exactly one `E90001` ICE, never throws — RD-06 ST-L5 **expectation unchanged**; only the stale `(IfStmt)` comment synced | 03-02 §4, PF-003/PF-006 |

## Phase 3 — Acceptance (`@blend65/test-harness`)

| ST | Input | Expected | Trace |
|----|-------|----------|-------|
| ST-19 | `buildSlice4b()` (real ACME) | assembles to a loadable PRG, `hasErrors === false` | FR-12 |
| ST-20 | `emitAsmSlice4b()` vs `test/golden/slice4b.asm.golden` | byte-exact | FR-12 |
| ST-21 | run the PRG on real VICE 3.10 (`skipIf(!hasVice())`) | `$C000 == $19` (25) && `$C001 == $07` (7) | FR-12, AR-13 |
| ST-22 | non-const case value via `compile()` | **E10071**, no binary, no throw | FR-13 |
| ST-23 | duplicate case value via `compile()` | **E10132**, no binary | FR-13 |
| ST-24 | boolean switch via `compile()` | **E10075**, no binary | FR-13 |
| ST-25 | gate / slice3a / slice3b / slice4a goldens | unchanged (byte-exact regression) | rollout |

## Verify command

```
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```

The emulator ST (ST-21) runs locally only (`skipIf(!hasVice())`, AR-27); the CI golden/assemble/
negative tiers guard behavior in CI. The full test-harness VICE suite is proven per-file locally
(the aggregate sequential-emulator run exceeds the sandbox timeout — a known environment limit).
