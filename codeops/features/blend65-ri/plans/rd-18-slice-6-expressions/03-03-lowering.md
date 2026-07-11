# IL Lowering & Synthetic Slots: RD-18 Slice 6

> **Document**: 03-03-lowering.md
> **Parent**: [Index](00-index.md)

## Overview

Grows `lower.ts` (and the SFA projection feeding it) to cover the Slice-6 surface:
promotion coercions, unary, casts, comparison operand typing, compound assignment,
non-const `lo`/`hi`, the signed-div guard, and the multi-block short-circuit/ternary
shapes over synthetic SFA frame slots (AR-6).

## Architecture

### 1. Synthetic result slots (AR-6)

**Why**: short-circuit is a language guarantee (branches mandatory); translate
forbids values crossing basic blocks (`producedThisBlock` guard). Results therefore
flow through memory the frame planner owns.

**Naming**: `0sc<N>` — the leading digit is source-illegal (`isIdentStart` is
`[A-Za-z_]`, `lexer.ts:29`) so no user local can ever collide, and the full frame
symbol (`__frame_<fq>_0sc<N>`) stays ACME-legal (digits are valid mid-symbol).
*(Concrete-character refinement of AR-6's recorded intent — `$` is ACME's hex-literal
introducer and cannot appear in symbols.)*

**Collection** (`packages/frontend/src/sfa/model-adapter.ts`): `modelToFunctionInfo`
already walks functions post-typing. NEW: for each function, walk the body in
**preorder (parent before children, fields in declaration order)** counting
slot-needing sites — `ConditionalExprNode`, and `BinaryExprNode` with op `&&`/`||` —
appending a synthetic local `{ name: "0sc"+i, type: model.typeOf(site), byRef: false }`
per site to `FunctionInfo.locals` (the `FrameVar` shape — the planner derives the
byte size from `type`; after real locals; params-first ordering unchanged).
Poisoned sites still get a slot with a **1-byte placeholder type**
(`primitive("byte")`, never `ERROR_TYPE` whose `byteSize` is 0) — they ICE at
lowering anyway; the count just stays consistent.

**`__init` slots**: module-variable initializers may contain the same sites. The
adapter emits ONE additional pseudo-`FunctionInfo` named `__init` (empty callees,
no params) whose locals are the synthetic slots collected across ALL initializer
expressions in `model.initOrder`, preorder per initializer, in init order. SFA plans
it like any leaf frame (`__init` runs to completion before `_main`, so frame sharing
with user functions is safe by the same reasoning that lets sibling leaves share).
When no initializer needs a slot, no pseudo-entry is emitted (zero-diff for
slot-free programs — plan-local AC-1 protects the 5b golden).

**Lowering contract**: `LowerCtx` gains a `scCounter` (reset per function / per
`__init` stream). `lowerConditional`/`lowerShortCircuit` claim `0sc<scCounter++>` at
**node entry, before recursing into children** — the same preorder the adapter used,
so indices align. Guard (two checks): the slot name must exist in `ctx.frame` (or
the `__init` frame) **and** the frame slot's byte size must equal the site's result
size; a miss OR a size mismatch raises the unsupported-ICE — neither a counting bug
nor an ordering bug can miscompile (mirrors the 5a never-miscompile guards).

**Known limitation (loud)**: `lowerSwitch` re-lowers the discriminant fresh once
per case value (a temp cannot cross blocks), so a discriminant containing a slot
site (`&&`/`||`/ternary) over-claims slots and always trips the frame-miss ICE.
The shape is rejected loudly this slice (an impl test witnesses the ICE); real
support — e.g. pre-materializing the discriminant into its own slot — is deferred.

### 2. Promotion coercion helper

```ts
/** Emit zext/sext when the value's IL width is below the required type's. */
function coerce(value: ILOperand, from: Type, to: Type, ctx: LowerCtx): ILOperand
```

- same width → value unchanged (cross-sign reinterpret is bit-free, TS-12).
- 8→16: `zext` for unsigned SOURCE, `sext` for signed SOURCE (value-preserving; the
  four-quadrant rule — the source's signedness picks the extension, the target's
  signedness reinterprets).
- 16→8: `trunc` (explicit casts only — implicit narrowing never reaches lowering).

Call sites: binary operands (each operand coerced to the `commonType` from
`typeMap` before the op), assignment/init values, call arguments (param type from
the callee decl), `ret` values, ternary arms (to the node's result type),
`lo`/`hi` byte-width arguments.

### 3. Binary lowering changes (`lowerBinary`)

- Operands coerced per §2; the instruction `type` = `ilTypeOfType(model.typeOf(expr))`
  for value classes.
- **Comparisons** (AR-9, closes DEF-1/AR-5): `type` = the **promoted operand type**
  (`commonType` of the operand types from `typeMap`; ERROR fallback IL_BYTE as
  today), NOT the byte result. `COMPARISON_RESULT_OPS` keeps typing the `dest` temp
  as IL_BYTE. **The same operand-type stamping applies to the other two compare
  emission sites**: the for-loop Pattern-A predicate (`compareCounter` — stamp
  `counterType` instead of the hardcoded IL_BYTE) and the switch dispatch `eq`
  chain (`lowerSwitch` — stamp the discriminant's IL type). Byte operands still
  produce IL_BYTE at all three sites (prior goldens unchanged); word for-loop
  counters and word/sword switch discriminants — both legal today — stop
  comparing low-bytes-only.
- **Signed `div`/`mod` guard** (AR-2): operand type signed → `iceUnsupported(expr,
  ctx, "signed division/modulo (unsigned runtime routines only)")` — before any
  emission.
- `&&`/`||` route to `lowerShortCircuit` (never through `BINARY_OP_TO_IL`).

### 4. Short-circuit lowering (`lowerShortCircuit` — AR-6, AR-8)

Value-producing for ALL contexts (generic value path — AR-8). For `a && b` with slot
`S` (blocks via the 4a builder):

```
<cur>:   tA = lower(a)            ; boolean 0/1
         store tA -> S            ; the a-is-false result
         brcond tA ? rhs : join
rhs:     tB = lower(b)
         store tB -> S
         br join
join:    tR = load S              ; the expression's value
```

`||` mirrors (brcond tA ? join : rhs). Nesting works by recursion — each site owns
its slot; inner sites claim theirs on entry (preorder). The `load` in `join` is
consumed in-block by whatever operation follows (the normal fold machinery applies).

### 5. Ternary lowering (`lowerConditional` — AR-6, AR-8)

Standard diamond over slot `S`: lower condition in the current block, `brcond` to
`then`/`else`; each arm lowers its expression, coerces to the node's result type
(§2), stores to `S`, `br join`; `join` loads `S`. Only the selected arm executes —
Ch 04 §7.2 rule 4 falls out of the CFG shape.

### 6. Unary lowering (`lowerUnary`)

| Op | Emission |
|----|----------|
| `-` | `neg {dest, src, type}` (signed types only — typing guarantees; defensive ICE otherwise) |
| `~` | `not {dest, src, type}` |
| `!` | `eq {dest, left: src, right: imm(0), type: IL_BYTE}` — boolean is 0-false/nonzero-true (Ch 02 §2), so logical not IS the ==0 test; no new IL op |
| `&` | `iceUnsupported` ("address-of is not supported yet") — Slice 8 (AR-11) |

### 7. Cast lowering (`lowerCast`)

Via §2 `coerce` from `typeMap.get(operand)` to the target type; same-width casts
emit `copy` only when the operand is not already a temp of the right IL type
(re-typing a temp's view is free — the `copy` keeps the printer honest). Boolean/
void/aggregate casts never reach lowering (typed E10086/E10155 → poison → the
existing poison-skip).

### 8. Compound assignment (`lowerAssign` growth — TS-17)

For `op !== "="` on the two supported scalar targets (Ident local / module var,
qualified module var): load the target's current value (`load` from its storage
location), lower the RHS, coerce both to the expansion's result type, emit the
binary op (shift/arith/bitwise — same table as `lowerBinary`, including the signed
div/mod guard for `/=` `%=`), coerce the result back to the target width (typing
guarantees assignability — same width by then), `store`. Scalar l-values have no
side effects, so single-evaluation is structural. Other target shapes: existing ICE.

### 9. Non-const `lo`/`hi` (`emitLo`/`emitHi` growth)

Const args keep the immediate fold. Non-const (typed in a `word` context per
03-01 §7):

- `lo(x)`, 16-bit `x` → `trunc {dest: t8, src: x16}` (translate reads the
  operand's home low byte). 8-bit `x` → identity: the lowered operand IS the
  result, no instruction.
- `hi(x)`, 16-bit **memory-resident** `x` (an `Ident` / qualified module-var) →
  a byte `load` from the variable's storage location **at offset +1**. The high
  byte of a two's-complement word IS the sign-carrying high byte, so this is
  correct for `sword` with no arithmetic-shift machinery. `hi(x)` for 8-bit
  unsigned `x` → `imm(0)`. A **computed** 16-bit argument or an `sbyte`
  argument → the loud unsupported-ICE this slice. (An earlier shr-by-8
  formulation is dropped: a word shift result not consumed by a store hits
  translate's word-fold ICE by design; generalizing is deferred.)

### 10. `lowerInitCode` — threads the `__init` pseudo-frame (when present) into its
`LowerCtx` so §4/§5 slots resolve; `initTempCount` continues to flow as today.

## Integration Points

- 03-01 typing provides `typeMap` promotions this module trusts (poison → skip).
- 03-04 translates the new ops; the slot `store`/`load` traffic uses existing
  load/store translation (frame symbols) unchanged.
- SFA: no allocator changes — synthetic locals ride `FunctionInfo.locals` and the
  existing interference machinery; `__init` adds one frame entry.
- `print-il.ts`: no changes (all emitted shapes already print).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Signed `/` `%` reaches lowering | loud unsupported-ICE, nothing emitted | AR-2 |
| Slot name absent from frame OR slot size ≠ site size (count/order drift) | loud unsupported-ICE — never wrong addresses | AR-6 |
| Switch discriminant containing a slot site (over-claim) | loud frame-miss ICE (known limitation, §1) | AR-6 |
| `hi()` of a computed-word / `sbyte` argument | loud unsupported-ICE, nothing emitted | — |
| `&` address-of | loud unsupported-ICE | AR-11 |
| Poisoned subexpressions | existing poison-skip (function skipped; diagnostics already out) | — |

## Testing Requirements

ST-23…ST-27 (07) pin IL shapes via `emitIl`/print. Impl tests: slot-count AND
slot-size parity (adapter vs lowering walk on nested `a && (b ? c : d)` shapes),
coerce quadrants, compound desugar single-store, comparison operand-type stamping
at all three emission sites (DEF-1 witness at this tier: word compare carries
i16u), `__init` pseudo-frame presence/absence, the switch-discriminant-with-slot-
site loud-ICE witness.
