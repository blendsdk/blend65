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
  spec §8.5 `:401`.)
- **FR-2 — Const case values.** Every value in every `CaseClauseNode.values` must fold via
  `evalConst` to an **integer** constant; a value that does not fold to an integer constant (a
  non-const expression, an identifier, or a `bool`/non-integer literal) → **E10071**. This is the
  **first** case-value check and shadows FR-3 for non-integer constants. (AR-10, AR-7; spec §8.6 `:405`.)
- **FR-3 — Case-value type-match.** For a value that **did** fold to an integer constant (FR-2
  passed), its type must match the discriminant type. Because integer literals **adapt** to the
  discriminant type (`typeNumericLiteral` context-adaptation) and out-of-range integer constants are
  handled by the range check (**E10084**, FR-3a), **E10077** fires only for a folded constant whose
  type is a genuinely **different, non-adapting primitive** (e.g. an integer discriminant with an
  enum/other-primitive constant once those exist). The check is **bespoke** (emit E10077 directly —
  *not* the assignment path, which would emit E10152/E10153/E10154). Precedence: **E10071** (not an
  integer const) → **E10084** (integer const out of the discriminant's range) → **E10077** (folded
  const of a different non-adapting type). (spec §8.6 `:406`, spec-numbered E10072 — remapped to
  E10077 because E10072 is taken, AR-4/AR-5. Preflight PF-002.)
- **FR-3a — Case-value range.** An integer case constant outside the discriminant type's range
  (e.g. `case 300` on a `byte` switch) → **E10084** via the existing `checkConstRange` — a **range**
  error, not a type-mismatch. (Preflight PF-002.)
- **FR-4 — Duplicate case values.** A case value equal to one already used (within a multi-value
  list or across clauses) → **E10132** (wire the registered code). (AR-7, AR-8; spec §8.6 `:407`.)
- **FR-5 — One default (parser-owned; deferred at semantics).** Spec §8.7 `:412` assigns a second
  `default` clause **E10076**, but the RD-03 parser keeps `defaultClause` in a single slot and
  **silently overwrites** a duplicate `default:` (last-wins, no marker), so the AST reaching the
  analyzer carries exactly one `defaultClause` — a semantics-side E10076 check is **structurally
  unreachable**. 4b therefore does **not** deliver E10076: a duplicate `default` is currently
  accepted silently (last-wins). Genuinely emitting E10076 requires a **parser** check
  (`parse-stmt.ts` ~:293) and is recorded as a follow-up (out of 4b's semantics+codegen scope, AR-5).
  (Preflight PF-001.)
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
- **Duplicate-`default` diagnostic E10076** — unreachable from semantics (parser silently overwrites
  a duplicate `default`, last-wins); genuinely emitting it needs a parser check (`parse-stmt.ts`
  ~:293). Deferred as a parser follow-up. (Preflight PF-001.)
- **Out-of-switch `fallthrough` rejection** — a stray `fallthrough` outside any switch is not
  visited by the case-body scan; it stays silently accepted by semantics (and still ICEs at codegen).
  A dedicated diagnostic is deferred to a later cleanup slice. (Preflight PF-003.)
- Parser `E10072`/default-required reconciliation to spec §8.7 (AR-5).
- `until` (4a AR-3); loop-var read-only E10060 / nested-reuse E10062 / no-shadowing E10101 (4a
  AR-2/AR-5); full-range Pattern-B (4a AR-6) — a later cleanup slice, not 4b (AR-14).
- User function **calls** → Slice 5.

## 4. Rollout / bookkeeping (Phase 4)

- **Close RD-18 AC-3** `[~]`→`[x]` (Slice 4 complete: 4a + 4b). (AR-14.)
- Advance RD-04 deferred-ledger rows **R75** (switch expr + case values), **R79** (`fallthrough`
  context); leave **R76** (exhaustive enum switch) deferred to Slice 7 (AR-2). (AR-14.)
- Register **five** codes additively (E10077 new + E10071/E10073/E10074/E10075 spec-numbered, all
  absent from the registry & Ch-14 — PF-004); the wired-but-previously-unemitted E10132 marked live;
  **E10076 not registered** (deferred parser-owned, PF-001). (AR-4/AR-7.)
- **SR-2** resource delta (compare-chain code size vs 4a; no new ZP/runtime routines) + the
  **five-code** Ch-14 additive-deviation entry (PF-004) + **SR-3** deferral closeout
  (enum/exhaustiveness, jump-table, parser reconciliation, **E10076 duplicate-default**, **out-of-switch
  `fallthrough`** — PF-001/PF-003) recorded in the plan.
- Roadmap sync (feature + portfolio); `git status --porcelain spec/` empty; final full verify green.

## 5. Success criteria (definition of done)

All FR-1…FR-4, FR-3a, FR-6…FR-13 met (FR-5/E10076 is **deferred parser-owned** per §3 — not a 4b
deliverable); the 3-part bar green (assemble-clean + CI golden + local VICE); negatives reject via
`compile()`; RD-18 AC-3 closed; full workspace verify green; `spec/` untouched.

## 6. Security considerations

`switch` is pure control flow over already-validated integer values — no new input-surface. The
const-evaluator is bounded (no user-controlled recursion); malformed input yields a **diagnostic,
not a crash** (the analyzer skips-or-reports, lowering ICEs-once-never-throws). Duplicate/overlong
case lists are bounded by source size. No injection/traversal/authz surface.
