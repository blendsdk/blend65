# Call Codegen: RD-18 Slice 5a — User Functions, Parameters & Calls

> **Document**: 03-03-call-codegen.md
> **Parent**: [Index](00-index.md)
> The two codegen gaps: `lowerCall`'s user branch (`il/lower.ts:602`) and translate's
> `case "call"` (`instr/translate.ts:254-307`). Everything else is already built
> (02-current-state §Codegen). Decisions: AR-3, AR-4, AR-12 (startup untouched).

## 1. The calling convention (normative shape)

Spec Ch 06 §5.4/§6.1: the caller evaluates arguments left-to-right (FN-10), stores each
into the callee's static frame slot, then `JSR`; the callee's body reads its params from
those slots (already works — `lower.ts:171-173,621-632`); the return value comes back in A
(8-bit) / A:X (16-bit) and `RTS` (already works — `translate.ts:364-370`).

## 2. Lowering (`il/lower.ts` — `lowerCall` user branch)

The intrinsic path (`:595-601`) is untouched. The `iceUnsupported` at `:602` is replaced by:

1. **Resolve the callee** via `ctx.model.symbolOf(expr.callee)` → function symbol → FQN
   (same `fn.scope.node.name` recovery the adapter uses) → the param slot symbols are
   `frameSymbol(calleeFqName, paramName)` (`lower.ts:902-904` — the scheme already matches
   `symbols.ts`). Param names + IL slot types come from the callee's declaration via the
   model (names) and the allocation plan's frame slots (types), mirroring how
   `lowerFunction` builds its own param locations (`:171-173`).
   **Fallback (PF-006):** a callee that is not an `IdentExpr`, or for which `symbolOf`
   returns no function symbol — e.g. a qualified `Math.add(…)` call, which type-checking
   silently poisons with `hasErrors` still false (03-01 §3.2) — → `iceUnsupported`,
   preserving the current `:602` contract for still-unsupported call shapes; never
   dereference an unresolved symbol.
2. **AR-3 residual guard (before emitting anything):** if any argument after the first
   contains a nested user call whose reachability (visited-set-bounded DFS over
   `model.callGraph.edges` — must terminate on any input, PF-002) includes the callee
   itself → `iceUnsupported(expr, ctx, "call to '<fn>' inside an
   argument of a call to '<fn>'")`. (Sibling shapes are NOT guarded — 03-02 §3's
   interference edges make them correct.)
3. **Store-per-arg (AR-3):** for each argument `i` in order: lower the argument expression
   to a value operand, then `builder.emit({ op: "store", … target: loc(paramSlotSymbol_i,
   slotType_i) })` immediately. Left-to-right evaluation AND the spec's interleaved store
   shape fall out; every arg value is memory-homed the moment it exists, so later-arg JSRs
   cannot clobber it (the frames are disjoint per 03-02 §3).
4. **Emit the call:** non-void → `dest = builder.newTemp(ilTypeOfType(returnType))`;
   `builder.emit({ op: "call", dest?, target: calleeFqName, args: [] })`. `args` stays
   empty by design — marshalling is explicit IL (`store` ops), the `call` is a bare
   transfer + result binding. (The printer renders both already; `readOperands`'
   `case "call"` returns the empty list — consistent.)
5. Expression-statement calls (void or discarded results) need no extra handling —
   the `ExpressionStmt` arm of `lowerStmt` (`lower.ts:208-211`) already lowers the
   expression and drops the value.

## 3. Translate (`instr/translate.ts` — new `case "call"`)

New `translateCall(ins)` dispatched from `translateInstruction`:

1. **AR-4 live-temp guard (before the JSR) — needs NEW bookkeeping (PF-001):** the
   existing `useCount` map is a STATIC per-temp total (populated once by `prescanAll`,
   `translate.ts:208-224`; never decremented) — it cannot answer "remaining uses at this
   point", and the register mirror deliberately retains a temp after its consuming store
   (`:595`), so residency alone cannot distinguish the must-compile `f(g(1), 2)` from the
   must-ICE `f() + g()`. The guard therefore builds a **separate** remaining-use map:
   initialized as a copy of the `prescanAll` totals (never decrement `useCount` in
   place — the single-use fold decisions at `translate.ts:407,650` read it), decremented
   **once per consumed operand occurrence** as instructions/terminators are translated
   (a word temp is read via two byte loads but is ONE occurrence). At a user-call `JSR`:
   if any temp with remaining > 0 is register- or `__zp_tmp`-resident →
   `iceUnsupported("value live across a call to '<target>' — evaluate calls into
   variables first")`. This is the named deferral for `f() + g()` shapes; the general fix
   (caller-frame scratch slots) is a later slice (AR-4). Values homed in frame slots /
   module vars (`location` operands) are safe and exempt.
2. Emit `JSR sanitize(target)` (the `Module_function` label scheme,
   `translate.ts:1028-1047`; the entry-function special case `_main` is unreachable —
   E10023 rejects main calls upstream).
3. **Result bind:** void call → `clearRegs()` only. Byte result → `bindA(dest)`; word
   result → `bindA(dest)` + `bindX(dest)` (the exact pattern `marshalAndCall` uses for
   `__rt_*` word results, `:850-888`). All other register/`__zp_arg` mirrors are cleared —
   a user callee may clobber anything (unlike the contracted `__rt_*` routines).
4. No prologue/epilogue work: the function-entry label + `ret`→`RTS`/`RTI` epilogue already
   exist (`translate.ts:175,364-370`).

## 4. What explicitly does NOT change

- **Startup shim** (AR-12): `JSR _main` terminating variant untouched; fall-through is
  Slice 8's non-terminating variant work.
- **`__rt_*` marshalling** (`marshalAndCall`): the register/`__zp_arg` ABI for runtime
  routines is a different, contracted convention — unchanged.
- **IL types, terminators, printer, builder API**: the `call` op and `ret` terminator are
  used as defined (`instruction.ts:126-132,163`) — zero new IL surface.
- **Runtime embed dead-strip**: keys on registered routine symbols; user `JSR
  Module_function` targets are structurally unaffected (`embed.ts:56-82`).

## Code Example (fixture shape, caller side)

```asm
; r1 = add(x, 7)          — Math.add(a: byte, b: byte): byte
    LDA __frame_Main_main_x
    STA __frame_Math_add_a      ; store arg 1 into the callee's frame
    LDA #$07
    STA __frame_Math_add_b      ; store arg 2
    JSR Math_add                ; result in A
    STA __var_Main_r1
```

(Exact instruction selection may fold through the existing peephole-free translate rules;
the golden is minted from real output — this sketch is directional, not byte-normative.)

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Later arg's calls reach the same callee | `iceUnsupported` at lowering — explicit, never miscompiles | AR-3 |
| Value live across a user-call JSR | `iceUnsupported` at translate — explicit, never miscompiles | AR-4 |
| `call` reaching translate without the lowering guard (defensive) | the AR-4 guard also fires (live dest temps) or the stream validates; ICE band E9xxxx, never a wrong binary | AR-3/4 |
| Void-call result consumed | upstream type error (03-01 §3.3); lowering never sees it | AR-5 |

## Testing Requirements

- Spec tests: 07 ST-25..ST-30 (IL shape golden for store-per-arg + bare call; ASM caller
  sequence; word param/return round-trip; both ICE guards fire; first-arg nesting allowed).
- Impl tests: register-mirror state after JSR (cleared), nested same-callee-in-FIRST-arg
  compiles (allowed by AR-3), `sanitize` collision behavior for multi-module labels.
