# RD-18 Slice 4b — Requirements

> **Source**: [RD-18](../../requirements/RD-18-codegen-language-completion.md) (Slice 4 row; AC-3; Parked Q4)
> **Gate**: `00-ambiguity-register.md` ✅ PASSED (AR-1…AR-14)

## 1. Problem statement

The `switch` statement is fully parsed but does nothing: the analyzer skips it and codegen ICEs.
Slice 4b turns it on end-to-end for **integer** discriminants, reusing the Slice-4a multi-block CFG
keystone, so an integer `switch` program compiles, assembles, and VICE-verifies a computed result.
This completes the Slice-4 control-flow surface and **closes RD-18 AC-3** (AR-14).

## 2. Functional requirements

Each maps to spec `05-statements-control-flow.md` §8 + `F009-switch-statement.md`, and to an AR.

- **FR-1 — Discriminant typing + operand-type check.** The switch expression must type to
  `byte`/`sbyte`/`word`/`sword`; any other type (notably `boolean`) → **E10075**. (AR-2, AR-11;
  spec §8.7 `:401`.)
- **FR-2 — Const case values.** Every value in every `CaseClauseNode.values` must be a
  compile-time constant (fold via `evalConst`); a non-const value → **E10071**. (AR-10, AR-7;
  spec §8.6 `:406`.)
- **FR-3 — Case-value type-match.** Each case value's type must match the discriminant type
  (auto-promotion per Ch 02 TS-4 as already implemented for scalars); a mismatch → **E10077**
  (new code, AR-4). (spec §8.6 `:407`, spec-numbered E10072 — remapped to E10077 because E10072 is
  taken, AR-4/AR-5.)
- **FR-4 — Duplicate case values.** A case value equal to one already used (within a multi-value
  list or across clauses) → **E10132** (wire the registered code). (AR-7, AR-8; spec §8.6 `:408`.)
- **FR-5 — One default.** At most one `default` clause → a second one is **E10076**. (AR-7;
  spec §8.7 `:412`.) `default` is RD-03-required (AR-5) so it is always present.
- **FR-6 — `fallthrough` position.** `fallthrough` must be the **last** statement of a case body
  and must **not** appear inside a nested block (`if`/`while`/`for`) within the case → **E10074**.
  (AR-7; spec §8.3 `:380-382`.)
- **FR-7 — `fallthrough` no-effect.** A `fallthrough` in the **last** clause (last case, or the
  `default`, which is last) has nothing to fall into → **E10073** warning (AR-3; spec §8.3 + F009:110).
- **FR-8 — Case/default body locals.** `let` locals declared in case/default bodies are collected
  flat into the enclosing function frame (SFA slot each). (AR-12.)
- **FR-9 — `break`/`continue` transparency.** `break`/`continue` inside a switch target the
  **enclosing loop** (Swift model, spec §9), not the switch; a `break` in a switch with no enclosing
  loop stays **E10130**. Switch pushes no break/continue context. (AR-6.)
- **FR-10 — Compare-chain lowering.** `lowerSwitch` lowers the discriminant once, then per case
  value emits an `eq` compare + `brcond`(true → case-body block, false → next test); multi-value
  cases share one body block (AR-8); an unmatched discriminant falls to the `default` body (or the
  join if default is empty). (AR-1.)
- **FR-11 — `fallthrough` codegen.** A case body without `fallthrough` terminates `br(join)`
  (auto-break); with a trailing `fallthrough`, terminates `br(next clause body)` (AR-9).
- **FR-12 — Acceptance (3-part bar).** `examples/slice4b/main.blend` (multi-value case +
  `fallthrough` + plain case + `default`) assembles clean (real ACME) to a loadable PRG, a byte-exact
  ASM golden is committed, and real VICE 3.10 asserts the poked result. (AR-13.)
- **FR-13 — Negatives.** Via the frontend-only `compile()` (no binary): a non-const case value →
  E10071; a duplicate case value → E10132; a `boolean` switch → E10075. (AR-13.)

## 3. Out of scope (deferred — with AR cites)

- Enum-typed switches + exhaustiveness **E10133** → Slice 7 (AR-2).
- Jump-table dispatch → Phase B optimizer (AR-1).
- Parser `E10072`/default-required reconciliation to spec §8.7 (AR-5).
- `until` (4a AR-3); loop-var read-only E10060 / nested-reuse E10062 / no-shadowing E10101 (4a
  AR-2/AR-5); full-range Pattern-B (4a AR-6) — a later cleanup slice, not 4b (AR-14).
- User function **calls** → Slice 5.

## 4. Rollout / bookkeeping (Phase 4)

- **Close RD-18 AC-3** `[~]`→`[x]` (Slice 4 complete: 4a + 4b). (AR-14.)
- Advance RD-04 deferred-ledger rows **R75** (switch expr + case values), **R79** (`fallthrough`
  context); leave **R76** (exhaustive enum switch) deferred to Slice 7 (AR-2). (AR-14.)
- Register **E10077** additively; the wired-but-previously-unemitted E10132 marked live. (AR-4/AR-7.)
- **SR-2** resource delta (compare-chain code size vs 4a; no new ZP/runtime routines) + **SR-3**
  deferral closeout (enum/exhaustiveness, jump-table, parser reconciliation) recorded in the plan.
- Roadmap sync (feature + portfolio); `git status --porcelain spec/` empty; final full verify green.

## 5. Success criteria (definition of done)

All FR-1…FR-13 met; the 3-part bar green (assemble-clean + CI golden + local VICE); negatives reject
via `compile()`; RD-18 AC-3 closed; full workspace verify green; `spec/` untouched.

## 6. Security considerations

`switch` is pure control flow over already-validated integer values — no new input-surface. The
const-evaluator is bounded (no user-controlled recursion); malformed input yields a **diagnostic,
not a crash** (the analyzer skips-or-reports, lowering ICEs-once-never-throws). Duplicate/overlong
case lists are bounded by source size. No injection/traversal/authz surface.
