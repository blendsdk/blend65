# Requirements: RD-18 Slice 5a — User Functions, Parameters & Calls

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-18](../../requirements/RD-18-codegen-language-completion.md) — the OWNING
> requirements doc (Slice 5 row of the Slice Map; AC-4). Normative language surface:
> `spec/06-functions.md` (FN-1..FN-13, §4 call rules, §5 SFA calling convention, §6 codegen
> patterns) + `spec/10-modules.md` §4 (export/import) — frozen, reference-only (D3).
> Itemized backlog: RD-04 `08-deferred-semantics-ledger.md` rows R10 (params, partial),
> R13/R22 (export/import), R58/R65 (call + function-decl validation), R80/R81 (return
> completion), R84–R87 (call graph + recursion), plus RD-06/RD-07 `call`.

## Scope of this plan (delta view)

### In this plan (5a)

- **RD-04 ledger R65** (partial) — parameter collection as `parameter` symbols, duplicate
  param → E10003; NO param-count limit (spec FN-11 refutes RD-04's "max 8" — AR-8).
- **RD-04 ledger R10** (partial) — FN-13 only: param name shadowing a module-level name →
  E10101 (AR-8). General shadowing stays deferred.
- **RD-04 ledger R58** — call typing: callee resolution, E10170 count, E10171 arg type
  (strict same-type, AR-5), result type = return type; E10175 `NotCallable` (AR-9), E10051
  interrupt-call (AR-10), E10023 main-call (AR-11).
- **RD-04 ledger R80/R81 remainder** — `return;` in non-void → E10172; return-expr mismatch
  → `checkAssignable` family E10152/E10153/E10154 with return wording (AR-6).
- **RD-04 ledger R84–R87** — call-graph edges (Pass 3, intrinsics excluded), `findCycles`
  (Tarjan SCC), one E10174 per cycle with the full path (AR-7); RD-04 AC-07 + AC-15 close.
- **RD-04 ledger R13 + R22** (functions subset) — `export` visibility on function symbols;
  import of exported user functions with E10012 validation; user-module-wins path
  precedence (AR-14). *Merging (R20) and qualified access (R17) → 5b.*
- **RD-05/SFA feed** — `modelToFunctionInfo` projects `parameters` + `callees`; the AR-3
  argument-window interference channel; recursion poisons before `planAllocation` (AR-7).
- **RD-06/RD-07 `call`** — `lowerCall` user branch (store-per-arg convention, AR-3) and the
  translate `call` case (`JSR` + A/A:X result bind), with the AR-3/AR-4 ICE guards.
- **Data-region relocation** — `DEFAULT_PROFILE.ramStart` `$0800` → `$2000` + the mandatory
  post-ACME code/data overlap check, as Phase 0 (AR-2). Closes the Slice-3b AR-1 deferral.
- **RD-18 three-part acceptance bar** — assemble-clean + CI golden + local VICE on the
  two-module fixture (AR-16).

### Deferred / out of this plan

- **→ Slice 5b (AR-1/AR-15):** module merging (R20), circular-import witness (R21, trivially
  satisfied today per-file but witnessed with merging), `Module.fn` qualified access (R17),
  module-var initializers + per-VARIABLE topological init order + E10194 (R23 — at the
  frozen Ch 10 §5.4 granularity, not RD-04 R23's import-graph wording). RD-18 AC-4 closes
  at 5b.
- **Named deferrals (gate):** same-callee-in-later-arg marshalling → explicit ICE (AR-3);
  value live across a user call (`f()+g()`) → explicit ICE, caller-frame scratch slots
  later (AR-4); W10181 unused-function (AR-11); import aliasing `as` (AR-13); startup
  fall-through = Slice 8's non-terminating variant (AR-12).
- **Other slices:** argument-position promotion (Slice 6, AR-5); by-ref struct/array params
  + `const` param semantics (Slice 7, with aggregates); `&fn` address-of, interrupt
  end-to-end, W10181 liveness (Slice 8).

## Plan-local decisions

| Decision | Chosen | AR Ref |
|----------|--------|--------|
| Slice 5 split; 5a/5b seam; trim threshold (~50 tasks → imports move to 5b) | Split; imports stay in 5a (fixture is two-module) | AR-1 |
| Data-region base + overlap guard + Phase-0 sequencing | `$2000`; check keyed off the plan's data base; single golden re-mint | AR-2 |
| Arg marshalling + soundness | store-per-arg + argument-window interference; same-callee residual → ICE | AR-3 |
| Call-crossing temps | translate-time detection → ICE; scratch-slot seam deferred | AR-4 |
| Argument type policy + codes | strict same-type; E10170/E10171 | AR-5 |
| Return completion codes | E10172; mismatch via E10152/53/54 with return wording | AR-6 |
| Recursion granularity/order | one E10174 per SCC + path; canonical anchor; pre-SFA poison | AR-7 |
| Parameter rules | full bundle: symbols, E10003, FN-13 E10101, no count limit | AR-8 |
| Not-callable code | E10175 repurposed → `NotCallable` | AR-9 |
| Interrupt-call | mint + wire E10051 | AR-10 |
| main-call / W10181 | wire E10023; W10181 named-deferred | AR-11 |
| Startup shim | keep `JSR _main` (terminating variant); scoped deviation | AR-12 |
| Import aliasing | named deferral | AR-13 |
| Import path precedence | exact user-module match wins; else platform registry | AR-14 |
| Verify command + fixture shape | standard verify; two-module fixture, `$C000..$C003` | AR-16 |

## Acceptance Criteria (plan-local)

1. [ ] Phase 0: all five existing fixtures byte-exact against re-minted goldens at the
       `$2000` data base, VICE re-verified locally; the overlap check rejects a synthetic
       code/data collision (ST-0x cases).
2. [ ] `examples/slice5a/` (two modules) assembles clean through real ACME to a loadable
       PRG with zero undefined symbols; byte-exact ASM golden committed; on real VICE:
       `$C000==$11`, `$C001==$84`, `$C002==$03`, `$C003==$10` (AR-16; ST cases own the
       derivation).
3. [ ] All negative fixtures reject via `compile()` with exactly the gated codes (E10174
       direct+indirect, E10170, E10171, E10012, E10023, E10051, E10175, E10172, E10003,
       E10101) — no binary produced.
4. [ ] The AR-3/AR-4 guards ICE (never miscompile) on the deferred shapes.
5. [ ] Rollout bookkeeping: ledger rows advanced (R58, R65-partial, R80/R81, R84–R87,
       R13/R22-subset, R10-FN-13), RD-04 AC-07/AC-15 ticked, RD-18 AC-4 annotated
       "5a partial; closes at 5b", registry deviations recorded (E10175 rename, FN-11
       no-limit, JSR-startup scoped deviation), roadmap synced.
6. [ ] Full workspace verify green; `git status --porcelain spec/` empty (D3).
