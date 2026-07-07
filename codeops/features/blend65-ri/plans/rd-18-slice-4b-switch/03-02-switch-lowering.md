# 03-02 — Switch IL Lowering (Phase 2)

Add one lowering case, `lowerSwitch`, to `packages/codegen/src/il/lower.ts`, producing a `brcond`
compare-chain over the Slice-4a multi-block CFG keystone. **No** `translate.ts` change, **no** new IL
terminator (AR-1; `02-current-state.md §4/§5`).

## §1 — Block shape (AR-1/AR-8/AR-9)

For `switch (D) { case v0a, v0b: B0  case v1: B1[fallthrough]  ... default: Bd }`:

```
  <lower D once → operand `disc`>            ; in the current block
  ; --- dispatch chain (test blocks) ---
  test0:  t = eq(disc, v0a); brcond t → body0, else t0b
  t0b:    t = eq(disc, v0b); brcond t → body0, else test1
  test1:  t = eq(disc, v1);  brcond t → body1, else testD
  testD:  br → bodyD                          ; default is unconditional tail (AR-5: always present)
  ; --- bodies ---
  body0:  <lower B0>;  br → join              ; auto-break
  body1:  <lower B1>;  br → body_next          ; trailing `fallthrough` → next body (AR-9)
  bodyD:  <lower Bd>;  br → join
  join:   <switch successor>
```

- **Dispatch** is emitted in **source order**, one test block per case value. Multi-value cases
  (AR-8) emit one `eq`+`brcond` per value, all true-edges pointing at the **shared** body block.
- **Default** (AR-5, always present): the dispatch chain's final `false` edge is an unconditional
  `br → bodyD`. If `defaultClause.body` is empty, `bodyD` is just `br → join` (or fold the final
  false-edge straight to `join`).
- **Bodies**: reserve one body block per clause (each case + default) up front so `fallthrough`'s
  "next body" edge (AR-9) is resolvable regardless of emission order. A body **without** a trailing
  `fallthrough` ends `br(join)`; **with** one, ends `br(<next clause body>)`. A `fallthrough` in the
  last clause was flagged E10073 at semantics and lowers as `br(join)` (nothing follows).
- **`break`/`continue`** inside a body resolve to the enclosing `LoopContext` (the 4a stack) — switch
  pushes **nothing** onto it (AR-6). A body that ends in a `break`/`continue`/`return` is already
  terminated; guard with `builder.isTerminated()` before appending the auto-`br` (the same guard 4a's
  `lowerBlock` uses).

## §2 — Implementation (AR-1)

Add `case "SwitchStmt": lowerSwitch(stmt, ctx); return;` to `lowerStmt` (replacing its fall-through to
the `default:` ICE at `:234`). `lowerSwitch(stmt, ctx)`:

1. Lower `stmt.discriminant` to an operand `disc` (existing expression-lowering path; the width is
   `ctx.model.typeOf(discriminant)` as 3b threaded).
2. `const join = builder.reserveLabel()`. For each clause (cases in order, then default) reserve a
   body label; keep an ordered list so clause *i*'s `fallthrough` target = body of clause *i+1*.
3. Emit the dispatch chain: for each case, for each value, fold the value (const, already validated),
   emit `eq(disc, value)` → temp, `brcond(temp, bodyLabel_i, nextTestLabel)`, `openBlock(nextTestLabel)`.
   After the last case's last test, `terminate(br(bodyLabel_default))`.
4. For each clause: `openBlock(bodyLabel)`, lower its `body` statements; if `!isTerminated()`,
   `terminate(br(fallthrough ? nextBodyLabel : join))`.
5. `openBlock(join)` — subsequent statements continue here.

Reuse helpers exactly as 4a's `lowerIf`/`lowerFor` do (`reserveLabel`/`openBlock`/`terminate`/
`isTerminated`, the `eq` lowering, the temp allocation). No new IL ops, no new terminator.

## §3 — Translate & the DEF-1 dependency (AR-13)

`translate.ts` needs **no** change: `run()` already loops all blocks and handles `br`/`brcond`
(`:366-382`). The dispatch chain leans on `eq` → `brcond`; the `eq` sequence is the one the 4a
**DEF-1/AR-16** fix corrected (branch-directly-after-`CMP`, no Z-flag clobber). Switch dispatch is
therefore correct **only** with that fix in place — a regression there would silently mis-dispatch,
so the acceptance VICE test (Phase 3) is the runtime guard, and the DEF-1 codegen regression added in
4a stays green.

## §4 — Repoint the "unsupported" fixture (AR — current-state §6)

`packages/codegen/src/il/test-fixtures.ts:271-277` uses a bare `fallthrough` as the "still
unsupported → single E90001 ICE" fixture. Once `switch` lowers, choose a genuinely-unsupported node
for that fixture (e.g. a Slice-5+ construct such as a user `call`, still ICE in `lowerStmt`), and
update the RD-06 `ST-L5` expectation accordingly (mirrors 4a's swap of `if`→`fallthrough`). A bare
top-level `fallthrough` outside any switch remains rejected upstream (parser/semantics), so it is no
longer a reliable *codegen* ICE fixture.

## §5 — Files touched

| File | Change |
|------|--------|
| `packages/codegen/src/il/lower.ts` | +`lowerSwitch` + `case "SwitchStmt"` in `lowerStmt` (remove its ICE fall-through) |
| `packages/codegen/src/il/test-fixtures.ts` | repoint `unsupportedFixture` off `fallthrough` |
| RD-06 `*.spec.test.ts` (ST-L5) | update the unsupported-node expectation to match the new fixture |
