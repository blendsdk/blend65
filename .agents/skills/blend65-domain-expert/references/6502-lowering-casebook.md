# 6502 Lowering Casebook

Use this reference to turn reconciled Blend65 semantics and typed IL into expert NMOS 6502/6510
code. Read `blend65-semantics.md`, `sfa-and-abi.md`, `il-and-optimization.md`, and
`mos-6502-family.md` first when their contracts are relevant. This casebook defines selection
criteria and proof duties. It does not freeze the future compiler's class graph or number of IRs.

## Lowering entry contract

Every selection decision must carry the following facts. Missing facts select a correct general
form or a diagnostic; they never authorize a guess.

| Field | Required content |
|---|---|
| semantic operation | Exact width, signedness, wrap/rounding, value/control use, evaluation order, and volatile effects |
| operands | Constant/symbol/runtime identity, current location, aliasing, alignment, range, and bank/visibility facts |
| incoming state | Live `A/X/Y`, every live flag, `D/I`, stack depth, SFA homes, and interrupt domain |
| candidates | Legal selected-CPU sequences, including the correct general candidate |
| effects | Produced/clobbered registers and flags, exact ordinary/volatile memory accesses, calls, banking, and control edges |
| complete cost | Code bytes, path cycles, call/setup/exit, helper body attribution, data/table/padding, ZP, SFA/frame, and hardware stack |
| enabling proof | Machine-checkable semantic, range, use, alias, layout, target, profile, and ownership preconditions |
| counterexample | At least one input/state/layout where an attractive candidate is wrong or loses |
| verification | Independent behavior oracle plus separate assembly/byte/cycle/resource expectation for every code-shape change |
| disposition | Automatic rewrite, cost-guided choice, zero-cost API/special lowering, explicit local contract, or diagnostic/no rewrite |

These fields are a reasoning schema, not a new compiler framework. The later redesign may encode
them in existing data structures if those structures can prove every obligation.

## Disposition boundary

| Disposition | Use it when | Do not use it when |
|---|---|---|
| automatic semantics-preserving | Legality and equivalence follow from already-known facts for every execution | Benefit or safety depends on an unproven workload, layout, alias, device, or concurrency assumption |
| cost-guided | Several legal forms trade bytes, cycles, data, ZP, layout, or call cost | The cost model omits a charged resource or uses source instruction count as a proxy |
| zero-cost API/special lowering | A named target intent maps to an exact direct sequence or link-time object with no hidden work | A wrapper adds calls, copies, temporaries, polling, or runtime dispatch an expert would not write |
| explicit local contract | Writable code, cycle-exact timing, IRQ ownership, silicon identity, or another non-local fact cannot be inferred | A machine-wide profile fact or ordinary dataflow proof already settles it |
| diagnostic/no rewrite | Source is illegal or the only proposed fast form lacks required proof | A correct general lowering exists and no platform limit forces rejection |

There is no generic “game optimization” switch. CPU choice, video model, and platform ownership may
be profile facts. Risky permission remains narrow and local.

## Cost vocabulary

For a candidate `c`, compare a resource vector rather than one scalar:

`cost(c) = {code, hotCycles, coldCycles, data, padding, zpBytes, sfaBytes, stackPeak, effects}`.

The selected optimization goal may prioritize elements, but it may not erase a hard budget. A
helper body is charged once when newly reachable, each call site is charged separately, and a
dead-stripped body costs zero. Page-cross and branch costs remain path ranges until placement makes
them exact. A whole-program win may justify a locally equal instruction sequence; it may not hide
new data, padding, banking, stack, or ZP cost.

Source keys: instruction facts come from `MOS-PGM-1976` and the selected-core deltas in
`WDC-65C02S-2022`; Blend65 semantics come from `BLEND65-SPEC-P3-ed278ab9`; proof and accounting
rules come from `evidence-parity-and-recovery.md` and `il-and-optimization.md`.

## Loads, stores, and moves

| Situation | Preferred candidates | Selection proof and full effect | Counterexample |
|---|---|---|---|
| constant to live `A/X/Y` | `LDA/LDX/LDY #imm` | Exact 8-bit constant; 2 B/2 cyc; produces `N/Z` | Loading `A` destroys a still-live accumulator value or useful flags |
| fixed RAM read | ZP or absolute load | ZP 2 B/3 cyc and one scarce byte; absolute 3 B/4 cyc | Promoting a cold value to ZP can displace a hot pointer pair and lose globally |
| fixed RAM write | ZP or absolute store | Store preserves flags; 2 B/3 cyc ZP or 3 B/4 cyc absolute | Replacing `LDA #0; STA a; STA b` with separate reloads wastes code/cycles; replacing with `STZ` is illegal on NMOS |
| indexed static object | `abs,X`/`abs,Y` | Read 3 B/4 `+p`; store 3 B/5 fixed. Prove index scaling and object visibility | Pretending a store has a same-page 4-cycle form undercounts it |
| dynamic pointer | `(zp,X)` or `(zp),Y` | Charge two-byte ZP pair, setup, lifetime, 6-cycle `(zp,X)`, or read 5 `+p`/store 6 for `(zp),Y` | A pointer at `$FF` wraps its high-byte fetch to `$00`; a static symbol did not need a runtime pointer |
| register move | transfer or preserved existing location | Most transfers 1 B/2 cyc and produce `N/Z`; `TXS` preserves flags but changes stack ownership | A transfer solely to match a rigid convention may force two later transfers/spills |
| overlapping memory move | Load before destructive store; direction-aware loop for ranges | Alias proof determines order; preserve exact source snapshot semantics | A forward copy corrupts `dst > src` overlap; blindly choosing `memcpy` behavior changes language semantics |
| volatile/MMIO access | Exact legal load/store sequence | Preserve width, identity, count, and order. Record bus accesses and flags | RMW, CSE, dead-store removal, or duplicated read can acknowledge or trigger a device twice |

Loads/stores are not isolated operations: reuse an already-live register value when its provenance
and intervening effects prove identity. Do not reload merely because a later textual rule expects a
home. Conversely, never infer a volatile value from a prior load.

## Boolean values and control flow

An IL condition should remain a condition until a value use requires `0` or `1`.

| Use graph | Expert lowering | Cost/effects | Required proof |
|---|---|---|---|
| comparison feeds one branch | comparison producer followed by matching branch | No Boolean home or materialization; branch is 2 B/2–4 cyc | No intervening instruction clobbers the consumed flags |
| logical `!` in branch context | swap true/false successors or invert branch | Usually zero instruction cost | Both edges preserve required evaluation order/effects |
| short-circuit `&&`/`||` | CFG edges that skip RHS | Charge only paths executed | RHS effects occur exactly under source short-circuit rules |
| condition feeds branch and later stored value | branch directly, materialize `0/1` only on escaping path/merge | Charge materialization once where demanded | Dominance/use proof shows the stored Boolean is correct on every predecessor |
| condition is only stored | branch-to-`LDA #0/#1` or a proven flag-to-value idiom | Record both paths and join; stores preserve earlier flags | Do not let layout fallthrough change the assigned value |
| branch out of range | inverse short branch over `JMP abs` | 5 B; path cycles depend on branch/JMP | Final addresses and inverse condition are known; relaxation reaches a fixpoint |

Example: unsigned `a >= b` in branch context is `LDA a; CMP b; BCS target`. With absolute operands
it is 8 B and 10 cycles not taken or 11 taken when no branch page cross. Materializing a Boolean
first is a defect unless the Boolean also escapes. Source: `MOS-PGM-1976` §§4.1–4.2; Q-C03/Q-C16.

Switch lowering compares a linear chain, balanced tree, or jump table using value density, path
frequency, table bytes, dispatch setup, branch reach, and layout. A jump table is not automatically
best on a 16-bit address/8-bit index machine; its bounds check, scaling, pointer/ZP, table, and
indirect-dispatch hazards are part of the candidate.

## Equality and unsigned comparison

| Operation | Byte lowering | Word/multi-byte lowering | Traps |
|---|---|---|---|
| `== 0`/`!= 0` | Reuse `N/Z` only when the value-producing instruction defines `Z`; otherwise `LDA value` then `BEQ/BNE` | OR all bytes only when clobber/order permits, or compare each byte with early exit | A store does not set `Z`; a volatile word may require exact ordered reads |
| `==`/`!=` | `CMP` then `BEQ/BNE` | Compare bytes with early inequality; order may follow cheapest/legal access because equality is symmetric | Do not consume stale flags across a reload/call |
| unsigned `<`/`>=` | `CMP`; `BCC/BCS` | Compare most-significant byte first, continue on equality, finally compare low byte | `C=1` means register `>=` operand; it is no-borrow, not borrow |
| unsigned `>`/`<=` | `CMP` plus equality-aware branch ordering | High-first lexicographic comparison | A single `BCC/BCS` does not distinguish equality for strict relation |

For modular multi-byte subtraction, process low to high so carry propagates. For relational
comparison, process high to low because the first differing most-significant byte decides order.
Do not share one byte order by convenience.

## Signed byte comparison

`CMP`, `CPX`, and `CPY` produce `N/Z/C` but preserve `V`. Therefore this sequence is invalid:

```asm
LDA lhs
CMP rhs
; INVALID: N xor V consumes whatever V existed before CMP
```

Seed both prior `V=0` and `V=1`; the answer must not change. Use one of these families.

### Constant sign normalization

When the right operand is a constant and `A` is available, signed order can be mapped to unsigned
order by flipping bit 7 on both operands:

```asm
LDA lhs
EOR #$80
CMP #(rhs ^ $80)
BCC less
```

For absolute `lhs`, this is 9 B; 10 cycles not taken or 11 taken, plus a taken page-cross cycle.
It clobbers `A`, `N/Z/C`; `V` is irrelevant. It is automatic only when the normalized RHS is a
link-time byte and no incompatible `A`/flag value remains live.

### Controlled binary subtraction

For two runtime operands, a classic branch decision is:

```asm
SEC
LDA lhs
SBC rhs
BVC no_overflow
EOR #$80
no_overflow:
BMI less
```

`SBC` actually produces `V`; flipping result bit 7 on overflow converts the sign of the wrapped
difference into the mathematical signed relation. `D=0` is mandatory. With absolute operands the
static sequence is 13 B. Excluding branch page crossings, the no-overflow path is 15–16 cycles and
the overflow path 16–17, depending on the final branch. Account for clobbered `A/N/Z/C/V`.

### Sign split

If preserving arithmetic result flags is undesirable, first test whether operand signs differ. A
different-sign pair is decided by `lhs`'s sign; a same-sign pair uses unsigned `CMP`. This can win
when source locations or likely paths favor early exit. It costs reloads or scratch if the sign
test destroys a needed operand. The compiler compares the actual candidates; it never declares
one universal signed-compare template.

Boundary proof includes every pair drawn from `{-128,-1,0,1,127}`, equal operands, and both initial
V states. `N` alone fails at overflowing differences such as `127 - (-1)`; `C` alone orders the
unsigned encodings. Source: reconciled signed semantics plus `MOS-PGM-1976` §2.2.1/§4.2.1 and
Appendix B; Q-C01/Q-C02.

## Signed word comparison

The signed high byte decides whenever high bytes differ; the low byte participates only when high
bytes are equal. The following complete sign-split baseline implements signed `lhs < rhs` for
absolute operands without a persistent normalized copy. `less` and
`not_less` are the two semantic successor blocks. All relative branches are assumed in range; add
one cycle to a taken branch that crosses a page, or apply normal long-branch relaxation.

```asm
LDA lhs+1
EOR rhs+1
BPL same_signs
LDA lhs+1
BMI less
JMP not_less
same_signs:
LDA lhs+1
CMP rhs+1
BCC less
BNE not_less
LDA lhs
CMP rhs
BCC less
JMP not_less
```

The static decision stream is 37 bytes. With no branch-page crossing, its path costs are:

| Input relation path | Cycles | Why |
|---|---:|---|
| different signs, negative `lhs` | 17 | sign difference plus taken `BMI` |
| different signs, non-negative `lhs` | 19 | sign difference plus `JMP not_less` |
| same sign, high byte lower | 22 | high-byte `CMP` decides |
| same sign, high byte greater | 24 | `BCC` falls through and `BNE` decides |
| same sign, equal high, low byte lower | 34 | low-byte `CMP` decides |
| same sign, equal high, low byte equal/greater | 36 | final `JMP not_less` |

The stream reads each absolute high operand more than once, clobbers `A/N/Z/C`, and preserves `V`.
ZP operands shorten each affected load/compare by one byte and one cycle but consume scarce ZP.
A normalized-high scratch candidate can reduce reads on some paths but must charge its home and
stores. This baseline is a correctness candidate, not a universal selection: layout, liveness,
operand location, relation kind, and path frequency still decide the winning form. A constant high
byte may instead use sign normalization. A controlled high-byte `SBC` may compete only if `D=0`,
its carry setup and clobbers fit, and lower-byte equality is still handled separately.

Counterexample: low-byte carry cannot repair a wrong signed-high decision. `$7FFF < $8000` is
false under signed order even though the low-byte comparison suggests no distinction; `$FFFF <
$0000` is true. Source: Q-C04.

## Addition and subtraction

| Semantic case | Candidate | Preconditions, effects, and cost rule | Counterexample |
|---|---|---|---|
| byte `a+b` | `CLC; LDA a; ADC b` | Establish source-independent carry; `D=0`; result and `N/Z/C/V` in A. Immediate/ZP/abs mode chooses bytes/cycles | Reusing live `C=1` computes `a+b+1` |
| byte `a-b` | `SEC; LDA a; SBC b` | `C=1` means no incoming borrow; `D=0` | Starting `CLC` subtracts an extra one |
| increment/decrement by one | `INC/DEC`, `INX/DEX`, `INY/DEY`, or `CLC/ADC`/`SEC/SBC` | Choose from current location, needed result flags, volatile/bus behavior, and carry liveness | Memory `INC` is RMW and unsafe as a silent MMIO replacement |
| word addition | `CLC; LDA loA; ADC loB; STA loR; LDA hiA; ADC hiB; STA hiR` | Low-to-high carry chain; overlap-aware scheduling; 16-bit modular result | Establishing `CLC` again before high byte loses low carry |
| word subtraction | `SEC; ...SBC low...; ...SBC high...` | Low-to-high no-borrow chain | Treating `C=1` as borrow reverses propagation |
| add/sub constant | fold, `INC/DEC`, byte-only low operation when carry/borrow is proven irrelevant, or full chain | Range/use proof must show omitted high work cannot affect observable result | Adding one to `$00FF` needs the high carry for a word result |
| multi-byte | same chain extended per byte | Width is semantic; alias and store scheduling preserve unread bytes | Writing destination low over source high through alias corrupts later input |

With absolute operands and result homes, the displayed word-add skeleton is 19 B/26 cycles; ZP
placement changes both but consumes four or more scarce bytes. This total is illustrative only:
reuse, aliasing, in-place result, immediate operands, and live registers create different candidates.
Always recompute from the actual stream. Q-C05 seeds both incoming carry states; Q-C06 does the
same for subtraction.

Wrapping arithmetic does not authorize removal of observable flags or volatile accesses.
Overflow diagnostics are compile-time range diagnostics where specified; no general runtime trap
is injected.

## Bit operations and tests

| Intent | Legal lowering | Decision rule |
|---|---|---|
| mask bits | `AND #mask` | Fold constants; preserve only desired bits. `N/Z` describe result, `C/V` remain old. |
| set bits | `ORA #mask` | For RAM, load/OR/store; for MMIO, preserve exact read/write semantics. |
| toggle bits | `EOR #mask` | A sign-bit flip is also useful for signed-order normalization when it does not create a stored source change. |
| test all clear/nonzero | `AND` on a disposable value or `BIT` | `BIT` preserves A but overwrites `N/V` from memory bits 7/6; use it only if those effects are legal. |
| clear/set one RAM bit | load/AND-or-ORA/store, or selected W65C02 `RMB/SMB` | NMOS target cannot use `RMB/SMB`; memory RMW/device effects still matter. |
| device acknowledge/control | exact platform-prescribed read/write | Never synthesize from a generic bitfield rule without the register contract. |

An optimization that replaces `LDA reg; ORA #m; STA reg` with an RMW form is invalid unless the
selected device contract proves the complete bus pattern equivalent. Q-C10 specifically rejects
`INC` on a VIC register from bytes/cycles alone.

## Shifts and rotates

| Case | Sequence family | Required reasoning |
|---|---|---|
| byte left by one | `ASL A` or memory `ASL` | Same bit pattern for signed/unsigned wrapping left shift; memory form is RMW. Produces shifted-out bit in C. |
| byte unsigned right by one | `LSR A` or memory `LSR` | Zero-fill; `N=0`. |
| byte signed right by one in A | `CMP #$80; ROR A` | `CMP` sets C to original sign, then `ROR` injects it. 3 B/4 cyc; final C is original bit 0. |
| word left | Shift low with `ASL`, rotate high with `ROL` | Low-to-high carry; define in-place alias/order. |
| word unsigned right | Shift high with `LSR`, rotate low with `ROR` | High-to-low carry. |
| word signed right | Establish high sign in C, `ROR` high, then `ROR` low | High-to-low; preserve sign while propagating original high bit 0. |
| rotate | `CLC/SEC` plus `ROL/ROR`, or carry already proven | A language rotate and a shift are different because carry participates. |
| constant count | fold zero; unroll small count; byte-select for whole-byte counts; choose loop/helper for larger work | Compare code expansion to frequency and live-state cost. Counts at least width follow semantic result, not hardware masking. |
| dynamic count | zero-count bypass, width-bound behavior, then loop/special candidate | Counter width/range, clobbers, and source count semantics are explicit. |

For a signed word right shift by one held in absolute memory:

```asm
LDA value+1
CMP #$80
ROR A
STA value+1
ROR value
```

This is 12 B/18 cycles on ordinary absolute RAM and clobbers `A/N/Z/C`. A ZP or register-resident
candidate differs. `LSR value+1; ROR value` is smaller but wrong for every negative input.

For signed `>>`, counts at least the width produce all ones for a negative input and zero for a
non-negative input. For unsigned `>>` and every `<<`, counts at least width produce zero. The
compiler may fold when sign/range is known; otherwise it must select or generate the correct
terminal fill. It must not apply the host language's shift-count masking. Source:
`BLEND65-SPEC-P3-ed278ab9`, `MOS-PGM-1976` Chapter 10, and Q-C13.

### Complete arithmetic-right-shift baselines

These baselines make Q-C13's width boundaries executable on NMOS. They assume a disposable
byte-sized count in `X`; preserving the count adds an explicit SFA spill/reload or another proven
register assignment. A semantic `word` count may use the same core only after proving its high byte
zero. Otherwise test the high byte first and take the terminal-fill path whenever it is nonzero.
For an absolute count, `LDY count+1; BNE wide_count; LDX count` adds 8 static bytes; it costs 7
cycles on a same-page taken wide path or 10 cycles before the low-byte path. It clobbers `Y`, and
also `X` on the low path. Run that preheader before loading a byte operand into `A`, or charge its
spill/reload. Branch costs below assume no taken page crossing.

For an `sbyte` already in `A`, constant count `k` selects:

| Count | Sequence | Static bytes | Cycles |
|---:|---|---:|---:|
| `0` | no instruction | 0 | 0 |
| `1..7` | repeat `CMP #$80; ROR A` exactly `k` times | `3k` | `4k` |
| `>=8` | sign-select `LDA #$ff` or `LDA #$00` | 8 | 7 negative / 8 non-negative |

The `>=8` terminal-fill stream is:

```asm
CMP #$80
LDA #$ff
BCS shift_done
LDA #$00
shift_done:
```

`CMP` obtains the original sign in `C`; both loads preserve it. For counts `1..7`, every repeated
`CMP` obtains the still-preserved sign of the current arithmetic result before `ROR`. Thus count 7
is 21 bytes/28 cycles, while count 8 and every larger count saturate instead of masking.

For an `sword` stored little-endian in ordinary absolute `value/value+1`, an unrolled constant
count `1..7` can keep the changing high byte in `A`:

```asm
LDA value+1
; repeat the next three instructions exactly k times
CMP #$80
ROR A
ROR value
; end repeat
STA value+1
```

This costs `6 + 6k` bytes and `8 + 10k` cycles; for `k=1` it is the 12-byte/18-cycle stream above.
For `k=8`, copy the original high byte to low and sign-fill high:

```asm
LDA value+1
STA value
CMP #$80
LDA #$ff
BCS fill_ready
LDA #$00
fill_ready:
STA value+1
```

That form is 17 bytes and 19 cycles for a negative input or 20 for a non-negative input. For
`k=9..15`, append `LDA value`, repeat `CMP #$80; ROR A` exactly `k-8` times, then `STA value`.
The combined form costs `23 + 3(k-8)` bytes and 27/28 `+ 4(k-8)` cycles for negative/non-negative
inputs. Count 15 is therefore 44 bytes and 55/56 cycles. For `k>=16`, sign-fill both bytes:

```asm
LDA value+1
CMP #$80
LDA #$ff
BCS word_fill_ready
LDA #$00
word_fill_ready:
STA value
STA value+1
```

This terminal form is 17 bytes and 19/20 cycles. The repeated and whole-byte forms are both legal;
the compiler chooses the smaller complete candidate for the actual count and live state.

A runtime `sbyte` count has this complete bounded loop:

```asm
CPX #8
BCC byte_below_width
CMP #$80
LDA #$ff
BCS byte_shift_done
LDA #$00
JMP byte_shift_done
byte_below_width:
CPX #0
BEQ byte_shift_done
byte_shift_loop:
CMP #$80
ROR A
DEX
BNE byte_shift_loop
byte_shift_done:
```

It is 25 bytes. Count 0 costs 10 cycles; count `k` in `1..7` costs `8 + 9k`; a wide count costs
11 cycles for a negative value or 15 for a non-negative value. It consumes `X` down to zero only
on the loop path and clobbers `A/X/N/Z/C`; `V` is preserved.

The analogous in-place absolute `sword` runtime form is:

```asm
CPX #16
BCC word_below_width
LDA value+1
CMP #$80
LDA #$ff
BCS word_store_fill
LDA #$00
word_store_fill:
STA value
STA value+1
JMP word_shift_done
word_below_width:
CPX #0
BEQ word_shift_done
LDA value+1
word_shift_loop:
CMP #$80
ROR A
ROR value
DEX
BNE word_shift_loop
STA value+1
word_shift_done:
```

It is 43 bytes. Count 0 costs 10 cycles; count `k` in `1..15` costs `16 + 15k`; a wide count costs
26 cycles for a negative value or 27 for a non-negative value. It changes both result bytes on the
terminal path, consumes `X` on the loop path, and clobbers `A/X/N/Z/C`. These examples consume no
extra ZP/SFA bytes because their stated operands already occupy `A`, `X`, or absolute result homes;
all moves, spills, alternate homes, and branch-page penalties are additional and must be charged.

## Negation and absolute value

| Operation | Candidate | Preconditions and corner cases |
|---|---|---|
| byte negate | `EOR #$FF; CLC; ADC #1` or `SEC; LDA #0; SBC value` | Three-instruction forms differ in load reuse and flags. Modular `-$80 == $80`; do not invent a trap. |
| word negate | complement both bytes, add one low-to-high | Carry propagation is required; overlap and live-register state choose ordering. Modular `-$8000 == $8000`. |
| absolute signed byte | sign test, leave nonnegative path, otherwise negate | `$80` remains `$80` under two's-complement wrap; the type cannot represent +128. Preserve the specified modular result. |
| absolute signed word | test high sign, conditional word negate | `$8000` remains `$8000`. Branch/path frequency and branch reach are part of cost. |

Do not diagnose the minimum signed value unless the language specification requires it. Blend65's
deterministic fixed-width wrap is a source semantic, not an accidental hardware leak.

## Multiplication

There is no NMOS multiply instruction. Selection proceeds from strongest proof to general work:

| Operand knowledge | Candidate families | Required full-cost comparison |
|---|---|---|
| both constant | Fold at compile time to the destination width | No runtime bytes/cycles; retain diagnostics and semantic wrap rules |
| multiply by `0` | Produce zero, remove other work only when evaluation/effects permit | Preserve volatile reads, calls, and source evaluation even when the arithmetic result is known |
| multiply by `1` | Identity/coalesce location | Transfers/spills may still be required by the consumer ABI |
| multiply by power of two | Constant shifts, byte relocation, or precomputed address expression | Signed/unsigned left shift has the same wrapped bit pattern, but counts and observed high bytes remain semantic |
| small constant | Shift/add/subtract addition chain | Count live temporaries, carry setup, stores, and all bytes/cycles; choose the chain for the actual constant and width |
| bounded small variable | Table, repeated addition, or specialized shift/add | Include table bytes, placement, index scaling, frequency, and worst path |
| general variable | Inline shift/add algorithm or reachable helper template | Helper body, call/ABI, scratch, reentrancy, and call-site count determine the choice |

For example, `x*10` may use `(x<<3)+(x<<1)`, but this is not “two shifts and an add” on an 8-bit
CPU if both shifted values must coexist. The real sequence includes copies/homes, carry, width, and
stores. An addition chain wins only after those costs are counted.

For a modular byte result already in `A`, representative exact candidates are:

| Operation | NMOS sequence assumption | Bytes | Cycles | Extra storage |
|---|---|---:|---:|---:|
| `x*0` | `LDA #0`; removing evaluation still needs an effects proof | 2 | 2 | 0 |
| `x*1` | keep the live `A` value | 0 | 0 | 0 |
| `x*2^k`, `1<=k<=7` | repeat `ASL A` | `k` | `2k` | 0 |
| `x*3` | `STA tmp; ASL A; CLC; ADC tmp` | 6 | 10 | 1 ZP byte |
| `x*5` | `STA tmp; ASL A; ASL A; CLC; ADC tmp` | 7 | 12 | 1 ZP byte |
| `x*10` | the `x*5` stream followed by `ASL A` | 8 | 14 | 1 ZP byte |
| `x*2^k`, `k>=8` | `LDA #0` after preserving required operand effects | 2 | 2 | 0 |

All are modulo 8 bits. Signed and unsigned operands therefore use the same low-byte bit pattern;
widening before multiplication is a different semantic operation and must sign- or zero-extend
first. A word value in absolute `lo/hi` multiplied by two uses `ASL lo; ROL hi`: 6 bytes/12 cycles,
two RMW accesses, and clobbered `N/Z/C`.

The following finite bit-serial baseline computes the full unsigned 8-by-8 product with the high
byte in `A` and the low byte in `mul_multiplier`. A modular byte result uses only that low byte.
Both inputs are compiler-owned ZP/SFA homes; the ZP figures shown are the best form, not free
allocation.

```asm
LDA #0
LDX #8
LSR mul_multiplier
mul8_loop:
BCC mul8_skip_add
CLC
ADC mul_multiplicand
mul8_skip_add:
ROR A
ROR mul_multiplier
DEX
BNE mul8_loop
LDA mul_multiplier
```

The complete form is 19 bytes, uses two ZP bytes and `X`, and costs
`131 + 4*popcount(multiplier)` cycles: 131..163, excluding input moves. Omitting the final load when
the low-byte consumer can use its home saves 2 bytes/3 cycles. It terminates for every multiplier
and is valid for signed or unsigned modular byte multiplication. A signed widening product needs a
sign-aware extension/correction because its high byte differs. `D=0` is mandatory for every taken
add path. The stream clobbers `A/X/N/Z/C/V` and the multiplier copy. Fully unrolling the eight bit
steps removes `DEX/BNE`: including setup and the final load it is 70 bytes and
`90 + 4*popcount(multiplier)` cycles, or 90..122. Constant chains, tables, and the looped/unrolled
forms compete on complete code/data/ZP/path cost; neither runtime form is universal.

Those are same-page base totals. Let `h=popcount(multiplier)` and let each `p` be 1 only when the
named taken branch crosses a page in final layout. The looped total adds
`(8-h)*pBCC + 7*pBNE`; the unrolled total adds the sum of `pBCC_i` for the zero-bit copies whose
forward `BCC` is taken. An untaken branch adds no page penalty.

For a modular 16-bit product, extend multiplicand, multiplier, and product to little-endian word
homes:

```asm
LDA #0
STA mul_product
STA mul_product+1
LDX #16
mul16_loop:
LSR mul_multiplier+1
ROR mul_multiplier
BCC mul16_skip_add
CLC
LDA mul_product
ADC mul_multiplicand
STA mul_product
LDA mul_product+1
ADC mul_multiplicand+1
STA mul_product+1
mul16_skip_add:
ASL mul_multiplicand
ROL mul_multiplicand+1
DEX
BNE mul16_loop
```

With all six bytes in ZP the complete loop plus initial product clear is 34 bytes and costs
`457 + 19*popcount(multiplier)` cycles: 457..761, excluding input/result moves. It uses six
writable ZP bytes and `X`, no hardware stack, and clobbers `A/X/N/Z/C/V`. The same low-word
algorithm serves signed and unsigned modular word results; a widening product must extend operands
according to their signedness first. Its add path also requires `D=0`.

The word figures are same-page base totals. With `h=popcount(multiplier)`, final layout adds
`(16-h)*pBCC + 15*pBNE` cycles under the same 0/1 page-cross definition.

When the 8-bit looped baseline becomes a helper, its exact body is 20 bytes including `RTS`; each call site
adds 3 bytes for `JSR`, 12 execution cycles for `JSR` plus `RTS`, and two hardware-stack bytes at
peak, before argument/result moves and saves. The corresponding word helper is 35 bytes including
`RTS` and has the same call/stack overhead. Shared writable scratch makes either helper
non-reentrant: mainline/IRQ/NMI overlap requires disjoint SFA variants or a proved non-overlap
contract. A newly reachable helper body is charged once; a dead-stripped helper costs zero.

A lookup table is not automatically faster: a word result may require two tables or interleaved
bytes, an index register, page placement, and page-cross reasoning. A 256-entry word table costs
512 data bytes before padding. A helper is not a general resident runtime: it is a compiler-owned,
dead-stripped template emitted only when reachable, with every scratch byte assigned by SFA and a
declared mainline/IRQ/NMI reentrancy contract.

Q-C14 passes only when fold, identity, power-of-two, addition-chain, table, inline, and helper
choices are compared by exact semantics and the complete resource vector. “Always call multiply”
and “always expand constants” both fail.

## Division and remainder

There is no NMOS divide instruction. Constant zero divisors are compile-time errors. For a runtime
zero divisor, the default unchecked operation terminates with an unspecified result of the correct
width and only its declared effects; no check, trap, fallback, or generic runtime is injected.
An optional safe-division mode may emit an inline check and selected failure action, and its bytes,
cycles, effects, and handler requirements are charged explicitly.

| Case | Legal candidate | Semantic guard |
|---|---|---|
| unsigned divide by `2^k` | logical right shift, byte select, or constant fold | Count semantics and width are exact; divisor is nonzero |
| unsigned remainder by `2^k` | `AND #(2^k-1)` or byte selection | Result width and preserved source effects match |
| signed nonnegative divide/remainder | unsigned power-of-two forms | Range proof establishes operand is nonnegative on every path |
| signed divide by `2^k` | bias then arithmetic shift, or a general signed algorithm | Quotient truncates toward zero. For negative `x`, add `2^k-1` before arithmetic shift at the semantic width |
| signed remainder by `2^k` | `x - trunc(x/2^k)*2^k` or equivalent sign-aware form | Remainder has dividend's sign and satisfies `x=q*d+r` |
| constant non-power divisor | reciprocal/add-shift or specialized subtract scheme only with exhaustive width proof; otherwise general division | Exact result for every value, including signed boundaries and wrap cases |
| variable divisor | restoring/non-restoring inline algorithm or reachable helper | Zero behavior, quotient/remainder widths, path bound, scratch, clobbers, and reentrancy are declared |
| quotient and remainder both live | combined algorithm/helper | Never perform two divisions when one pass yields both under the same semantics |

The decisive negative-odd checks are:

- `-3 / 2 == -1`, not `-2` as an arithmetic shift would produce; and
- `-5 % 2 == -1`, not `1` as an unsigned mask would produce.

Negating a minimum signed value as an intermediate can wrap back to itself, so a supposedly
sign-aware transform must prove that case or use a representation that handles it. Constant
reciprocal methods are admitted only after exhaustive or independently proven full-domain
equivalence; a few examples are not proof.

Inline-versus-helper is an equation, not a magic threshold. Choose helper `h` only when the
selected objective prefers:

`body(h if newly reachable) + sum(call setup + JSR + result move + spills) + scratch/stack costs`

over the sum of each legal inline candidate, subject to hard cycle, stack, ZP, and reentrancy
limits. Q-C15 owns signed power-of-two correctness; Q-C18 owns the complete helper comparison.

### Exact signed power-of-two baselines

For a positive divisor `2^k`, signed quotient uses
`(x + (x < 0 ? 2^k-1 : 0)) >> k`. The bias converts arithmetic-shift floor rounding to Blend65's
truncation toward zero. For a same-width positive `sbyte` divisor, `1<=k<=6` uses:

```asm
CMP #$80
BCC quotient_byte_biased
CLC
ADC #(2^k-1)
quotient_byte_biased:
; repeat exactly k times
CMP #$80
ROR A
; end repeat
```

This is `7 + 3k` bytes, `5 + 4k` cycles for a non-negative dividend, and `8 + 4k` for a negative
dividend. It has no scratch, clobbers `A/N/Z/C/V`, and handles `$80` because adding at most `$7f`
cannot overflow the mathematical signed range. `D=0` is mandatory. `k=0` is the identity.
The cycle figures are same-page bases: the non-negative path adds one cycle when its taken `BCC`
crosses a page; the negative path has no taken relative branch.

For a same-width positive `sword` divisor and dividend in absolute `value/value+1`, `1<=k<=14`
uses this complete family. `biasLo` and `biasHi` are the two compile-time bytes of `2^k-1`:

```asm
LDA value+1
CMP #$80
BCC quotient_word_biased
CLC
LDA value
ADC #biasLo
STA value
LDA value+1
ADC #biasHi
STA value+1
quotient_word_biased:
LDA value+1
; repeat exactly k times
CMP #$80
ROR A
ROR value
; end repeat
STA value+1
```

It is `30 + 6k` bytes. The non-negative path costs `17 + 10k` cycles and the negative path
`38 + 10k`, excluding branch-page penalties. It changes the result home, clobbers `A/N/Z/C/V`,
and uses no additional scratch. `D=0` is mandatory. The signed minimum remains correct for every
representable positive power-of-two divisor. The only relative-branch addition is one cycle when
the non-negative path's taken `BCC` crosses a page.

Remainder does not need quotient materialization. For the same-width positive-divisor ranges just
stated, let `mask=2^k-1`. For an `sbyte` in `A`, first mask the low bits. A negative nonzero residue
becomes the signed remainder by setting every bit above the mask:

```asm
CMP #$80
BCC remainder_byte_positive
AND #mask
BEQ remainder_byte_done
ORA #(~mask & $ff)
JMP remainder_byte_done
remainder_byte_positive:
AND #mask
remainder_byte_done:
```

This is 15 bytes. The positive path is 7 cycles; a negative exactly divisible value is 9; a
negative nonzero residue is 13. It yields `-5 % 2 == -1` and zero for the signed minimum whenever
the divisor divides it. It uses no scratch and clobbers `A/N/Z/C` while preserving `V`.
These are same-page bases. Add one cycle when the positive path's taken `BCC` crosses a page, or
when the negative exact-multiple path's taken `BEQ` crosses a page. The negative nonzero path takes
neither relative branch and keeps its fixed `JMP` cost.

For an `sword` in absolute memory, use 16-bit `maskLo/maskHi` and their complements:

```asm
LDA value+1
CMP #$80
BCC remainder_word_positive
LDA value
AND #maskLo
STA value
LDA value+1
AND #maskHi
STA value+1
ORA value
BEQ remainder_word_done
LDA value
ORA #invMaskLo
STA value
LDA value+1
ORA #invMaskHi
STA value+1
JMP remainder_word_done
remainder_word_positive:
LDA value
AND #maskLo
STA value
LDA value+1
AND #maskHi
STA value+1
remainder_word_done:
```

The generic form is 63 bytes. It costs 29 cycles for a positive dividend, 35 for a negative exact
multiple, and 57 for a negative nonzero residue. Immediate ORs and their load/store pair are
removed when a complement byte is zero. The stream uses no extra scratch, changes the result home,
and clobbers `A/N/Z/C` while preserving `V`. For both widths, negative divisors or a demand for both
quotient and remainder add sign/result work and must be compared with the general combined
algorithm. Plain arithmetic shift or positive mask remains illegal without a non-negative or
equivalence proof.

Those word-remainder figures are same-page bases. Add one cycle when the positive path's taken
`BCC` crosses a page, or when the negative exact-multiple path's taken `BEQ` crosses a page. The
negative nonzero path takes neither relative branch and therefore adds no branch-page cycle.

## Constants and link-time facts

| Fact | Required lowering | Failure pattern |
|---|---|---|
| numeric constant | Fold through the specified width/type before instruction selection | Recreating a known expression through runtime ALU code |
| fixed symbol address | Keep assembler/linker symbol identity | Loading a pointer and calling an arithmetic helper for a link-time address |
| low/high symbol byte | Emit the assembler's low/high expression in an immediate or data field | Materializing the full address at runtime merely to select one byte |
| symbol plus constant offset | Preserve parentheses and relocation semantics in one symbolic expression | Serializing an ambiguous expression whose assembler precedence selects different bytes |
| placement-derived quotient/mask | Keep link-time expression when the assembler can decide it exactly | Applying a runtime divide/shift to an address known after layout |

The compiler must distinguish semantic runtime values from relocation-time expressions. It may not
constant-fold a final address before layout, and it may not lower a final-layout fact to runtime
work. Q-C20 requires exact symbol/byte output and later assembled-byte/symbol evidence.

For pinned ACME 0.97 syntax, `<expression` selects the low byte and `>expression` selects the high
byte. Preserve grouping around offsets:

```asm
LDA #<symbol
STA pointer
LDA #>symbol
STA pointer+1

LDA #<(symbol + offset)
STA pointer
LDA #>(symbol + offset)
STA pointer+1

!byte <symbol, >symbol
```

If `symbol=$1234`, the first two loads assemble as `A9 34` and `A9 12`; each is 2 bytes/2 cycles
and sets `A/N/Z` while preserving `C/V`. If `offset=$0102`, the parenthesized pair resolves to
`$36/$13`. The `!byte` form emits the address low byte then high byte. These are assembly-time
expressions and require zero runtime scratch or helper code. Parentheses are mandatory for a
symbol-plus-offset extraction because relying on operator precedence can select the byte before
performing the offset operation. Future artifact evidence must still inspect ACME's actual bytes
and symbol report; the syntax alone is not its own proof.

## Loops and induction

Start with correct ordinary CFG semantics: initializer once, condition before each iteration, body,
update, then condition; `break`, `continue`, calls, and effects keep their specified edges. Optimize
only a proved induction shape.

| Shape | Expert candidate | Proof and cost duties |
|---|---|---|
| zero trips | Remove body only if condition/evaluation effects are preserved | Exact compile-time condition and side-effect proof |
| one trip | Straight-line body/update/result as semantically observed | Loop variable scope/final observation and `continue` behavior |
| byte count below 256 | `X`/`Y` up/down counter when it also serves addressing; memory counter otherwise | Range, register pressure, value escape, calls, and wrap termination |
| exact 256 word iterations `0..255` | One 8-bit induction register, body, `INX; BNE loop` | Semantic word counter does not escape; terminal 256 is unobservable; body/calls cannot observe or alter hidden induction state; exact canonical step/bound |
| explicit byte `i < 256` | Preserve deterministic infinite wrap behavior and applicable compile-time nontermination diagnostic | Never silently widen, repair, or reinterpret it as a range loop |
| countdown including zero | Preheader and post-body decrement/branch arranged to include the intended endpoints | `0`, `1`, `255`, and `256` counts; no underflow off-by-one |
| fixed hot loop | no, partial, or full unroll | Trip count, body bytes/cycles, path frequency, layout/branch effects, I-cache not assumed, hard size budget |
| nested loops | Assign registers/homes from combined pressure and index use | Inner steady state matters, but outer setup and spills still count |

For the valid word loop `for (let i: word = 0; i < 256; i += 1)`, the internal byte-form candidate
visits `$00..$FF`; `INX` changes `$FF` to `$00`, `BNE` falls through, and no source-visible byte
pretends to hold semantic 256. `INX; BNE` costs 3 B and 5 cycles on each taken same-page back edge,
4 cycles on exit, plus body and setup. If the branch crosses a page, taken iterations cost one more.
If the loop variable escapes or a call can observe it, use the correct word state instead.

For a fixed-trip loop, unrolling saves update/branch cycles but duplicates the body and can push
other branches out of range or add alignment padding. Q-C22 requires measured full/partial/no-unroll
candidates; “constant count” alone is insufficient.

## Calls, returns, ABI, and helpers

`JSR` plus `RTS` costs 4 code bytes and 12 CPU cycles, excluding every argument/result move, spill,
save, bank transition, and indirect-dispatch sequence. It consumes two hardware-stack bytes at
peak. SFA—not the hardware stack—owns ordinary parameters, locals, temporaries, spills, and helper
scratch.

| Situation | Candidate and rule |
|---|---|
| leaf call | Omit saves for registers/flags proven dead across the edge; do not invent a universal callee-save set |
| non-leaf call | Account for transitive stack peak, SFA interference, argument staging, and live caller values |
| tail position | Replace compatible `JSR; RTS` with `JMP` only when ABI, bank, interrupt domain, and result/cleanup obligations match |
| inlining | Compare removed call/ABI traffic against duplicated body, layout, and register/SFA pressure at every site |
| shared helper | Emit only if reachable; assign explicit ABI and SFA scratch; variant or reject when concurrent domains overlap |
| address-taken/unknown caller | Use the declared stable entry contract; do not specialize from known direct callers alone |
| IRQ/NMI reachability | Use disjoint bounded SFA homes/variants or a proven non-overlap contract; include hardware saves and stack peak |
| indirect call/return emulation | Treat pointer storage, dispatch sequence, writable vectors, return mechanism, and reentrancy as explicit target mechanisms |

Q-C18's two call sites do not make a helper cheaper by themselves. If one site is IRQ-reachable,
a shared scratch home may be illegal or may require a second helper variant. Dead stripping, body
attribution, `JSR/RTS`, marshalling, clobber saves, ZP, SFA, and hardware stack all participate.

## Pointers and addresses

| Address shape | Candidate | Enabling facts and hazards |
|---|---|---|
| static symbol | absolute/absolute-indexed | Final visibility and index scaling; no pointer setup |
| static symbol plus constant | assembler expression | Range/relocation and correct parentheses |
| dynamic base plus byte index | `(zp),Y` when Y is available, or patched/direct candidate under stronger contract | Two-byte page-safe ZP pointer; read `+p`; store fixed 6; base+Y wraps 16-bit |
| pointer table indexed by X | `(zp,X)` | ZP table and both wrapping stages intentional; fixed 6 cycles |
| word element index | scale ordinal by element size using proof-guided byte/carry/word operations | Source ordinal is 16-bit-capable; do not narrow because array storage is bytes |
| bank-visible address | platform operation plus pointer/address | CPU address alone is insufficient; selected bank state is an effect and precondition |
| local address | ordinary word representation with hidden borrow provenance | Must remain within proven local lifetime and non-retaining calls; address use extends SFA liveness |

Pointer arithmetic wraps in the defined 16-bit address domain. The compiler may keep carry flowing
directly into address formation rather than materializing a word temporary, but source behavior and
borrow provenance remain exact. A static address becoming a runtime pointer is a performance defect
unless a runtime consumer genuinely requires the pointer.

## Aggregates, copies, and layout

| Case | Selection rule |
|---|---|
| small fixed copy | Compare straight-line load/store pairs with a loop, including body duplication, index setup, branch, page cost, and register pressure |
| large fixed copy | Direction-aware indexed loop, specialized page loop, or loader/placement solution; count 256-bound behavior exactly |
| possible overlap | Preserve source-defined snapshot/move semantics with proven direction or temporary strategy |
| device destination | Preserve exact write order/count and any timing contract; generic copy loops are not automatically legal |
| table used in place | Prefer final placement and direct addressing over startup duplication |
| AoS versus SoA | Choose from access paths, element size, index scaling, update grouping, cache not assumed, and developer expressiveness |

An unrolled copy of `n` bytes is not simply `n` instructions: each byte normally needs a load and
store, address operands vary in width, and overlap may constrain order. A loop adds setup, index,
branch, and possibly page-cross cost. Placement that eliminates the copy dominates both when the
hardware can read the original data and lifetime/visibility agree.

Struct-of-arrays often gives an 8-bit index direct access to one hot field. Array-of-structs can be
better when whole records move together or a record's byte size gives cheap scaling. Both remain
expressible; the compiler must not force the developer into a hardware-shaped source layout.

## Volatility and device memory

A volatile operation preserves all of these observables:

1. address identity and selected bank/device;
2. access width and byte order;
3. read/write count;
4. relative order against other volatile operations;
5. bus pattern when the device distinguishes it; and
6. source control path on which it occurs.

Therefore volatile reads are never commoned or speculated, volatile writes are never removed as
dead/redundant, and a read/ALU/write sequence is not silently changed to NMOS RMW. Ordinary RAM
alias analysis does not prove device equivalence. The platform register contract may define a
specialized zero-cost API whose direct sequence is then the authority.

## ZP promotion

Zero page behaves like a small memory-backed register file, but its opportunity cost is global.
Promote a home or pointer only when the saved operand bytes/cycles across weighted accesses exceed:

- initialization/move and preservation cost;
- any new spills or displaced higher-value ZP allocation;
- pair contiguity/page-safety constraints;
- mainline/IRQ/NMI duplication or non-reentrancy cost; and
- reserved platform/runtime bytes.

A ZP pointer consumes two contiguous bytes and may not begin at `$FF` for ordinary indirect use.
Do not score two isolated byte savings while omitting the displaced pointer that loses one cycle on
every frame.

## Page and branch alignment

Alignment is cost-guided and final-layout-owned. It may remove a hot indexed-read or taken-branch
page penalty, but padding bytes, shifted downstream symbols, branch reach, hardware alignment, and
load format are part of the cost. Re-run final relaxation after layout changes.

No generic “align loops to page” rule is valid. A loop whose back edge already remains in one page
gains nothing, while padding it can move a table or another branch across a worse boundary.

## Tables and pre-shifted data

Replace arithmetic with data only when the complete program wins:

| Charged item | Question |
|---|---|
| table payload | How many bytes and entries are actually required for each result byte? |
| placement/padding | Does alignment add bytes or move another object? Is the CPU/VIC bank correct? |
| access | Which index/pointer form, page penalties, setup, and live-register costs apply? |
| workload | How often and on which path is the result needed? Can a compile-time constant remove the work instead? |
| behavior | Does the table cover the whole semantic domain, including signed/wrapped values? |
| ownership | Can IRQ and mainline read it safely? Is it immutable or synchronized? |

Pre-shifted sprite/image variants can save frame cycles but multiply asset bytes and loading cost.
That is a target/game-engine decision in Phase 5, not an automatic arithmetic rewrite. Q-C24
requires both behavior proof and the full table ledger.

## Computed dispatch

Candidate families include compare chains, balanced decisions, jump tables, and writable-vector
dispatch. A jump table on NMOS commonly requires bounds proof, index scaling for two-byte entries,
low/high table access, a page-safe indirect vector, and `JMP (vector)` with its `$xxFF` constraint.
Charge all of it.

A writable return-address or vector technique also consumes page-one/ZP/static storage and changes
reentrancy/interrupt obligations. It is never selected from case count alone.

## Self-modifying specialization

Patching the operand bytes of an absolute instruction can replace repeated indirect setup, but it
is never a default optimization. It requires an explicit local contract proving:

- code is in writable CPU-visible RAM at every patch and execution;
- the exact operand-byte addresses and selected CPU behavior are known after layout;
- one owner or a synchronization protocol prevents partial/concurrent patch observation;
- routine re-entry and every reachable IRQ/NMI path are safe;
- bank changes cannot hide a patch or execute a different copy;
- the patch stores and any visibility delay are included in cost; and
- measured steady-state benefit beats the best safe `(zp),Y`, absolute-indexed, or duplicated
  specialization candidate.

Without every fact, keep the safe form or diagnose a requested contract. Q-C23 supplies writable
code, ownership, IRQ, frequency, and alternative costs; performance intent alone fails.

## Undocumented opcodes

The CPU policy in `mos-6502-family.md` controls undocumented opcodes. General lowering uses only
official selected-core forms. A future exact-silicon local contract must prove one encoding's full
behavior, effects, timing, physical/emulator coverage, and official fallback. W65C02 reserved-NOP
behavior is not evidence for NMOS. There is no program-wide “illegal opcodes on” shortcut.

## Generated-code review

Review one semantic path at a time, then the whole program:

1. Reconstruct the source operation, exact widths/signedness, evaluation order, and volatile effects.
2. Annotate every instruction with inputs, outputs, flags, memory/bus accesses, bytes, and path cycles.
3. Follow liveness through branches and calls; reject stale register/flag assumptions.
4. Recompute page, branch, ZP pair, stack, SFA, bank, and target-legality conditions from final facts.
5. Compare against the smallest correct expert hand-written candidate for the same preconditions.
6. Charge helper bodies, call sites, tables, padding, copied data, initialization, and displaced ZP.
7. Require an independent semantic oracle and a separate intended shape/cost oracle for each changed sequence.
8. Record any local parity meet that cannot yet be beaten as actionable compiler debt; do not call it complete.

Generated assembly that looks idiomatic is not proof. Optimized and unoptimized paths can share a
lowering bug, so differential execution is supporting evidence only. Q-C21 requires two independent
expectations: behavior and assembly/resource outcome.

## Qualification case map

| Cases | Knowledge that must be applied |
|---|---|
| Q-C01/Q-C02 | `CMP` stale-V rejection; signed-byte normalization/sign-split/controlled-`SBC`; both initial V states and full signed boundaries |
| Q-C03 | Direct unsigned carry branch without Boolean materialization |
| Q-C04 | Signed high byte decides first; low byte only on equality |
| Q-C05/Q-C06 | Source-independent initial carry; low-to-high word carry/no-borrow chain |
| Q-C07 | NMOS IRQ does not supply CMOS D-clear; selected ABI owns binary entry |
| Q-C08/Q-C09 | ZP pointer wrap and NMOS indirect-`JMP` page wrap |
| Q-C10 | Exact RMW/device bus semantics before any replacement |
| Q-C11/Q-C12 | Branch and indexed-read path timing; fixed indexed-store timing; final layout ownership |
| Q-C13 | Signed arithmetic shift, count boundaries, byte/word state and cost |
| Q-C14/Q-C15 | Multiply selection and signed power-of-two division/remainder correctness |
| Q-C16 | Direct branch plus only demanded Boolean materialization |
| Q-C17 | Selected-CPU legality independent of assembler acceptance |
| Q-C18 | Inline/helper body, ABI, dead-strip, SFA/ZP/stack, and IRQ reentrancy costs |
| Q-C19 | Ordinary three-clause semantics and proof-gated 256-iteration byte-form lowering |
| Q-C20 | Symbolic low/high link-time resolution without runtime materialization |
| Q-C21 | Independent behavior and separate assembly/cost oracles |
| Q-C22 | Measured full/partial/no-unroll decision |
| Q-C23 | Writable-code, ownership, reentrancy, IRQ, bank, and measured-benefit self-modification contract |
| Q-C24 | Table bytes, padding, placement/banking, access frequency/cost, and behavior proof |

## Failure conditions

The casebook is being misapplied if it selects from mnemonic count alone, leaves a consumed flag
without a producer, hides page/branch path variance, treats ZP or tables as free, emits a general
resident runtime, shares non-reentrant helper/SFA storage across interrupt domains, changes a
volatile bus pattern, materializes a link-time fact at runtime, uses a CMOS/undocumented form on
C64, or accepts assembly shape as its own behavior proof.
