# 03-01 — Switch Semantics (Phase 1)

Wire `switch` into the analyzer: discriminant/case typing, the validators, case-body local
collection, and the diagnostic-code additions. All in `@blend65/frontend` (+ the code registrations
in `@blend65/core`). No `passes.ts` change. Cites are `file:line` from `02-current-state.md`.

> **Code count (Preflight PF-004).** Recon confirms that of the switch band **only `E10072` currently
> exists** in `diagnostic-codes.ts`; `E10071`/`E10073`/`E10074`/`E10075`/`E10077` are **all absent**
> (and none appears in the frozen Ch-14 registry either). So this phase registers **five** codes, not
> one: the genuinely-new mint **E10077** (`CaseValueTypeMismatch`, AR-4) **plus** the four
> spec-Ch-05-numbered codes it emits (E10071/E10073/E10074/E10075). `E10132` already exists (wired,
> not minted). **E10076 is not registered** — it is deferred parser-owned (PF-001). The Phase-4
> additive-deviation ledger (SR-2) must record **five** new registry entries drifting from Ch-14.

## §1 — New diagnostic code (AR-4)

`packages/core/src/diagnostics/diagnostic-codes.ts` — add to the switch band, next to `E10072`:

```ts
CaseValueTypeMismatch: "E10077",  // AR-4: spec E10072's semantics; E10072 taken by MissingDefaultClause
```

Message (renderer): `Case value type '<case_type>' does not match switch expression type '<switch_type>'`.
Provenance comment mirrors the 4a additions (spec Ch-14 drift = accepted deviation, AR-115). The
codes `E10071`/`E10073`/`E10074`/`E10075` are the spec-numbered switch checks 4b emits — recon
confirms **all four are absent** from the registry, so **register all four additively** here (same
additive pattern) alongside the new `E10077`. `E10076` is **not** registered — it is deferred
parser-owned (PF-001). `E10132`/`E10133`/`E10130` already exist (`02-current-state.md §3`).

## §2 — `statement-typing.ts` — `case "SwitchStmt"` (AR-11)

Add an arm at the dispatch (currently `default:` `:138-141`). Sequence:

1. **Type the discriminant** via the existing expression-typing path (spec §8.5 `:401`). Compute
   `dt = typeOf(discriminant)`.
   If `dt` is not one of `byte`/`sbyte`/`word`/`sword` (reuse `integerRange(dt) !== null`, as 4a's
   `typeFor` does for the counter) → **E10075** at the discriminant span, then **poison** (skip the
   rest; never cascade). `boolean`/error/aggregate all fall here (AR-2). *(Enum discriminants also
   fall here in 4b — enum types don't exist yet, AR-2; when Slice 7 adds them, this guard widens.)*
2. **Const-fold, range-check, and type-match each case value (PF-002).** For every `CaseClauseNode`
   and each `value` in its `values`, apply these checks **in precedence order** — the first that
   fires emits and the value is skipped (poison-local, no cascade):
   - **(a) E10071 — not an integer constant.** `evalConst(value)` (the 3b/4a evaluator, AR-10). If the
     result is not `kind:"value"` **or** its value is not a `number` (i.e. a non-const expression, an
     identifier, or a `bool`/non-integer literal — `evalConst` folds `BoolLit` to a boolean) →
     **E10071** at the value span.
   - **(b) E10084 — integer const out of range.** For a folded integer constant, run the existing
     `checkConstRange(value, dt, ctx)` — a value outside `dt`'s range (e.g. `case 300` on `byte`) →
     **E10084** (`ValueOutOfRange`). This is a **range** error, not a type mismatch.
   - **(c) E10077 — case-value type-mismatch.** *Bespoke* check (emit E10077 directly — **not** the
     assignment path `checkAssignable`, which would emit E10152/E10153/E10154). Integer literals
     **adapt** to `dt` via `typeNumericLiteral`, so a bare integer literal is same-type by
     construction and never reaches here; E10077 fires only for a folded constant whose type is a
     genuinely **different, non-adapting primitive** vs `dt` (the live trigger arrives with enum/other
     constants in later slices). In the integer-only 4b surface E10077 is registered and wired but
     rarely reachable — that is expected; it exists so the check is in place when non-adapting
     constants become possible. (AR-4.)
3. **Duplicate detection (E10132, AR-8).** Maintain a `Set<number>` (or `Map<value → firstSpan>`) of
   folded case values across **all** clauses (multi-value lists included). A repeat → **E10132** at
   the offending value span, naming the first-use line (message carries `<N>`).
4. **At-most-one default (E10076) — NOT enforced here; parser-owned/deferred (PF-001).** Recon
   resolved the grounding question definitively: `parse-stmt.ts parseSwitch` keeps `defaultClause` in
   a **single slot** and **silently overwrites** a duplicate `default:` (last-wins, ~:294) with no
   marker — so the AST reaching this arm carries exactly one `defaultClause` and a semantics-side
   E10076 check is **structurally unreachable**. 4b therefore does **no** E10076 work: a duplicate
   `default` is accepted silently. Genuinely emitting E10076 needs a parser check (`parse-stmt.ts`
   ~:293) and is a deferred follow-up (out of 4b's semantics+codegen scope, AR-5). **No E10076 in the
   registry mint** (03-01 §1).
5. **`fallthrough` validation (E10073/E10074, AR-3/AR-7).** For each clause body, locate any
   `FallthroughStmt`:
   - Not the **last** statement of the body, or nested inside an inner block (`if`/`while`/`for`/
     `Block`) within the case → **E10074** at the fallthrough span.
   - The last statement of the body but the clause is the **last** clause (the `default`, or the last
     case when — per AR-5 default always exists, so this is effectively the `default` body) → **E10073**
     **warning** at the fallthrough span (AR-3). *(Position analysis is a shallow structural scan of
     the body statement list — the fallthrough is only ever a direct child of `body` per the grammar;
     "nested" means it appears inside a child `Block`/`If`/loop, which E10074 forbids.)*
6. **Recurse each clause body** through the existing body-typing routine (the same call 4a uses for
   `if`/loop bodies) so nested statements/expressions type and locals resolve. `break`/`continue`
   inside keep the enclosing `loopDepth` (AR-6) — switch does **not** change it.

**No poison cascade:** each check emits at most one diagnostic per offending node and suppresses
dependent errors (the R114 single-cascade discipline 3b established).

## §3 — `function-collection.ts` — `SwitchStmt` arm (AR-12)

Add a `case "SwitchStmt":` to `collectStmtLocals` (currently `default:` `:165-168`) that iterates
`stmt.cases` (each `.body`) and `stmt.defaultClause.body`, recursing `collectStmtLocals` on each
contained statement — exactly mirroring the `IfStmt`/`ForStmt` recursion at `:142-164`. This harvests
`let` locals declared in case/default bodies into the enclosing **function** scope (SFA frame slot
each). No block-scope lifetime (deferred, 4a AR-9).

## §4 — Files touched

| File | Change |
|------|--------|
| `packages/core/src/diagnostics/diagnostic-codes.ts` | +`CaseValueTypeMismatch: "E10077"` **and** the four absent spec-numbered codes E10071/E10073/E10074/E10075, additively (five total; **not** E10076 — deferred, PF-001) |
| `packages/frontend/src/semantics/type-check/statement-typing.ts` | +`case "SwitchStmt"`: discriminant/case typing + E10075/E10071/E10084/E10077/E10132/E10073/E10074 (no E10076) |
| `packages/frontend/src/semantics/function-collection.ts` | +`SwitchStmt` arm in `collectStmtLocals` |

## §5 — Diagnostics summary (this phase)

| Code | Name | Trigger | Sev |
|------|------|---------|-----|
| E10075 | (invalid switch operand type) | discriminant not byte/sbyte/word/sword | error |
| E10071 | (case value not constant) | a case value not const-foldable **to an integer** | error |
| E10084 | ValueOutOfRange (existing) | integer case const outside discriminant range (e.g. 300 on byte) | error |
| **E10077** | **CaseValueTypeMismatch** (new) | folded const of a **different non-adapting** primitive vs discriminant (rarely reachable in integer-only 4b) | error |
| E10132 | DuplicateCaseValue (wired) | repeated case value | error |
| E10074 | (fallthrough misplaced) | `fallthrough` not last stmt / in nested block | error |
| E10073 | FallthroughNoEffect | `fallthrough` in the last clause/default | **warning** |

*(E10076 "multiple default" is **deferred parser-owned** — not emitted at semantics, PF-001. Check
precedence for a case value: **E10071** → **E10084** → **E10077**, PF-002.)*

*(Exact registry names for the pre-existing spec-numbered codes are confirmed against
`diagnostic-codes.ts` during task 1.2.1; new mint is E10077 only.)*
