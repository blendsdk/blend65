# 03-01 — Switch Semantics (Phase 1)

Wire `switch` into the analyzer: discriminant/case typing, the six validators, case-body local
collection, and the one new diagnostic code. All in `@blend65/frontend` (+ one code in
`@blend65/core`). No `passes.ts` change. Cites are `file:line` from `02-current-state.md`.

## §1 — New diagnostic code (AR-4)

`packages/core/src/diagnostics/diagnostic-codes.ts` — add to the switch band, next to `E10072`:

```ts
CaseValueTypeMismatch: "E10077",  // AR-4: spec E10072's semantics; E10072 taken by MissingDefaultClause
```

Message (renderer): `Case value type '<case_type>' does not match switch expression type '<switch_type>'`.
Provenance comment mirrors the 4a additions (spec Ch-14 drift = accepted deviation, AR-115). The
codes `E10071`/`E10073`/`E10074`/`E10075`/`E10076` are the spec-numbered switch checks; add any
absent from the registry additively at this gate (same additive pattern), and confirm each already
present is reused verbatim. `E10132`/`E10133`/`E10130` already exist (`02-current-state.md §3`).

## §2 — `statement-typing.ts` — `case "SwitchStmt"` (AR-11)

Add an arm at the dispatch (currently `default:` `:138-141`). Sequence:

1. **Type the discriminant** via the existing expression-typing path. Compute `dt = typeOf(discriminant)`.
   If `dt` is not one of `byte`/`sbyte`/`word`/`sword` (reuse `integerRange(dt) !== null`, as 4a's
   `typeFor` does for the counter) → **E10075** at the discriminant span, then **poison** (skip the
   rest; never cascade). `boolean`/error/aggregate all fall here (AR-2). *(Enum discriminants also
   fall here in 4b — enum types don't exist yet, AR-2; when Slice 7 adds them, this guard widens.)*
2. **Type + const-fold each case value.** For every `CaseClauseNode` and each `value` in its
   `values`:
   - `evalConst(value)` (the 3b/4a evaluator, AR-10). If it does **not** fold to an integer constant
     → **E10071** at the value span; skip that value (poison-local, no cascade).
   - Type-check the value against `dt` using the existing scalar assignability (auto-promotion per
     TS-4, same path 3b uses). A mismatch → **E10077** at the value span (AR-4).
3. **Duplicate detection (E10132, AR-8).** Maintain a `Set<number>` (or `Map<value → firstSpan>`) of
   folded case values across **all** clauses (multi-value lists included). A repeat → **E10132** at
   the offending value span, naming the first-use line (message carries `<N>`).
4. **At-most-one default (E10076).** The parser yields a single `defaultClause` field, but a source
   with two `default:` clauses is a semantic error — detect it. *(Grounding task 1.2.x: confirm how
   the parser represents a second `default` — if it drops/overwrites, the check moves to the parser
   band; if it is recoverable in the AST, emit E10076 here. Resolve during implementation; if the
   parser already rejects duplicate defaults, record that E10076 is parser-owned and this sub-step is
   a no-op — a within-plan grounding item, not an ambiguity.)*
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
| `packages/core/src/diagnostics/diagnostic-codes.ts` | +`CaseValueTypeMismatch: "E10077"` (and any absent spec-numbered switch codes, additively) |
| `packages/frontend/src/semantics/type-check/statement-typing.ts` | +`case "SwitchStmt"`: discriminant/case typing + E10075/E10071/E10077/E10132/E10076/E10073/E10074 |
| `packages/frontend/src/semantics/function-collection.ts` | +`SwitchStmt` arm in `collectStmtLocals` |

## §5 — Diagnostics summary (this phase)

| Code | Name | Trigger | Sev |
|------|------|---------|-----|
| E10075 | (invalid switch operand type) | discriminant not byte/sbyte/word/sword | error |
| E10071 | (case value not constant) | a case value not const-foldable | error |
| **E10077** | **CaseValueTypeMismatch** (new) | case value type ≠ discriminant type | error |
| E10132 | DuplicateCaseValue (wired) | repeated case value | error |
| E10076 | (multiple default) | >1 `default` clause | error |
| E10074 | (fallthrough misplaced) | `fallthrough` not last stmt / in nested block | error |
| E10073 | FallthroughNoEffect | `fallthrough` in the last clause/default | **warning** |

*(Exact registry names for the pre-existing spec-numbered codes are confirmed against
`diagnostic-codes.ts` during task 1.2.1; new mint is E10077 only.)*
