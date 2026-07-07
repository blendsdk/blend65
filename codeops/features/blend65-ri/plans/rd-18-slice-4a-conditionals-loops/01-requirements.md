# RD-18 Slice 4a — Requirements

> **Source**: [RD-18](../../requirements/RD-18-codegen-language-completion.md) (Slice 4 row; AC-3; Parked Q3) · [spec Ch 05](../../../../../spec/05-statements-control-flow.md)
> **Gate**: `00-ambiguity-register.md` (AR-1…AR-15, ✅ PASSED)
> **CodeOps Skills Version**: 3.2.0

## 1. Goal

Turn on the first four control-flow constructs — `if`/`else`, `while`, `do-while`, `for`
(`to`/`downto`/`step`) — end-to-end (analyzer → SFA → IL → Instr → ACME → PRG → VICE), landing the
multi-block CFG codegen keystone. A program using nested loops + conditionals + `break`/`continue`
must compile to a loadable c64 PRG and VICE-verify a computed result. `switch` is deferred to 4b (AR-1).

## 2. Functional requirements

### Semantics (RD-04 control-flow validators — AR-2)

- **FR-1 — Condition typing (Ch 05 §3, CF-2).** The condition of `if`, `else if`, `while`, and
  `do-while` must be typed and must have type `boolean`; a non-boolean condition emits **E10134**
  (new, AR-7). The condition expression is recorded in `typeMap`.
- **FR-2 — Body typing + nested scopes (Ch 05 §2.3, AR-9).** Statements inside control-flow bodies
  (nested `let`, assignments, expression/return statements, and further nested control flow) are typed
  by recursing into the bodies. Nested `let` locals and the for-counter are collected into the
  enclosing function scope (flat-recurse) so each receives a frame slot.
- **FR-3 — For-loop counter (Ch 05 §7.4, AR-5/AR-9/AR-15).** The `for` counter (`varName`:`varType`) is
  registered as a symbol of `varType` in the function scope, visible to the bound, `step`, and body.
  Its type must be an integer type (`byte`/`sbyte`/`word`/`sword`); the counter-type annotation is
  **optional in the parser** (`varType` may be `null`), so a missing or non-integer counter type —
  detected as `integerRange(counterType) === null` — emits **E10065** (new, AR-15) and poisons the
  counter (no silent `ERROR_TYPE` fall-through). Shadowing/read-only are **not** enforced in 4a
  (deferred, AR-2/AR-5).
- **FR-4 — For-loop bound + step safety (Ch 05 §7.2.1/§7.3, AR-8/AR-10).** A **const-evaluable** end
  bound outside `[type_min, type_max]` of the counter type emits **E10064** (registered). A non-const
  bound is allowed (runtime compare, no range check). A `step`, if present, must `evalConst` to an
  integer **≥ 1**; zero/negative/non-const emits **E10061** (new, AR-8).
- **FR-5 — Loop context for `break`/`continue` (Ch 05 §9).** `break` outside any loop emits
  **E10130** (registered); `continue` outside any loop emits **E10131** (registered). Inside a loop,
  both are valid and produce branches (see FR-8).
- **FR-6 — All-paths-return (Ch 05 §4.2, AR-4).** A non-void function whose body does not return a
  value on **all** control-flow paths emits **E10102** (new). The analysis is structural: a block
  "definitely returns" if it contains a `return` at its top level, or ends in an `if`/`else` in which
  **both** branches definitely return. Loops and conditionals without an `else` do not guarantee a
  return. Distinct from E10172 (`return` present but value missing) and E10173 (void returns a value).

### Codegen (RD-06 IL lowering — AR-11/AR-12)

- **FR-7 — Multi-block CFG lowering.** `lower.ts` lowers `if`/`else`, `while`, `do-while`, and `for`
  into a multi-block `ILFunction` using the builder's `reserveLabel`/`openBlock`/`terminate`, emitting
  `br` (unconditional) and `brcond` (conditional, on the boolean condition operand) terminators.
  - `if (c) { A } else { B }` → `brcond(c, then, else)`; `then`: A → `br(end)`; `else`: B → `br(end)`;
    `end:`. `else if` chains nest the same shape. A missing `else` branches straight to `end`.
  - `while (c) { A }` → `cond: brcond(c, body, end)`; `body`: A → `br(cond)`; `end:`.
  - `do { A } while (c)` → `body: A → brcond(c, body, end)`; `end:`.
  - `for (let i:T = init to/downto bound step s) { A }` → init `i`; `cond:` compare `i` vs `bound`
    (`brcond`); `body`: A → `br(incr)`; `incr:` `i = i ± s` → `br(cond)`; `end:` (Pattern A, AR-6).
- **FR-8 — `break`/`continue` lowering (AR-12).** A loop-context stack of `{ breakTarget,
  continueTarget }` is pushed per loop. `break` → `br(breakTarget)` (loop `end`); `continue` →
  `br(continueTarget)` (the `cond` label for `while`/`do-while`, the `incr` label for `for`).

### Codegen (RD-07 IL→Instr — AR-11)

- **FR-9 — Multi-block translation.** `translate.ts` iterates **all** `fn.blocks` (today only
  `blocks[0]`), emits each block's `label`, and translates terminators: `br` → `JMP <target>`,
  `brcond` → evaluate the condition to a flag + conditional branch to `trueTarget`, fall-through/`JMP`
  to `falseTarget`, `unreachable` → no-op/`RTS` guard. Reuses `label()`/`labelRef()` and the
  `translateComparison` branch pattern.

### Acceptance (RD-12 3-part bar — AR-13)

- **FR-10 — Assemble-clean (CI).** `examples/slice4a/main.blend` compiles via `build()` through real
  ACME to a loadable c64 PRG with zero undefined symbols.
- **FR-11 — Golden (CI).** A committed `slice4a.asm.golden` of the emitted ASM (multi-block labels +
  branches present); byte-exact.
- **FR-12 — VICE (local).** On real VICE 3.10 the fixture drives `$C000 == <computed>` (exact value in
  `03-04`). Proves the loops/branches execute correctly.
- **FR-13 — Negative (CI).** A non-void function missing a return path is rejected with **E10102** via
  the frontend-only `compile()` facade (no binary, never throws).

## 3. Out of scope (deferred — AR references)

- `switch`/`case`/`default`/`fallthrough` + its validators/codes (Slice 4b — AR-1).
- `until` for-loop keyword (AR-3); loop-var read-only E10060, nested for-var reuse E10062,
  no-shadowing E10101, real block-scope lifetime (AR-2/AR-5/AR-9).
- Full-range `to <type-max>` wrap codegen — Pattern B (AR-6).
- User function **calls** (Slice 5); `&&`/`||` short-circuit conditions (Slice 6) — conditions in 4a
  use the comparison/boolean operators already lowered in 3b.

## 4. Success criteria (definition of done)

1. All FR-1…FR-13 implemented; the 3-part acceptance bar green (assemble-clean + golden + real VICE).
2. New codes E10061/E10065/E10102/E10134 registered (uniqueness test green); E10064/E10130/E10131 wired.
3. Full workspace verify green; gate/slice3a/slice3b goldens **unchanged** (no regression to the
   straight-line path).
4. `git status --porcelain spec/` empty throughout (D3).
5. Parent-AC bookkeeping done (Phase 5): Ch-05 loop/conditional ledger rows advanced; RD-18 AC-3
   annotated "4a partial; closes at 4b"; SR-2/SR-3 deltas recorded.
