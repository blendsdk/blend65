# Current State: Compiler-Wide Optimization Initiative

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Optimization Infrastructure

### IL Optimizer Passes (O1+)

| Pass | What It Does | Relevant Themes |
|------|-------------|-----------------|
| `ConstantFoldPass` | Folds binary ops on two immediates | Theme A (partial) |
| `ConstantPropPass` | Propagates known constant values through slots | Theme J |
| `CopyPropPass` | Propagates copy assignments | — |
| `DCEPass` | Dead code elimination + unreachable code | — |
| `DeadFunctionElimPass` | Removes uncalled functions | — |
| `DeadGlobalElimPass` | Removes unused global slots | — |
| `FunctionInliningPass` | Inlines small functions into callers | Theme F (creates the problem) |
| `ILPeepholePass` | Identity elim, strength reduction, load/store elim, jump elim | Themes A, C, F, G |
| `CSE` | Common subexpression elimination | Theme B |
| `LICM` | Loop invariant code motion | Theme B |
| `LoopUnroll` | Unrolls small fixed-count loops | — |

### ASM Backend Optimizer Passes

| Pass | What It Does | Relevant Themes |
|------|-------------|-----------------|
| `StoreLoadPass` | Removes redundant STA/LDA pairs | Theme F (partial) |
| `StackOptPass` | Removes redundant PHA/PLA pairs | Theme CG |
| `RegisterPromotePass` | Promotes memory counters to X/Y registers | Theme H |
| `BranchOptPass` | JMP chain collapse, unreachable code removal | — |
| `CompareBranchPass` | CMP+branch optimization | Theme K |
| `FlagPatternsPass` | Redundant CMP #0 removal, dead flag ops | Theme K |
| `Strength6502Pass` | Runtime mul/div/mod → inline sequences | — |
| `TransferOptPass` | Redundant TAX/TXA elimination | — |
| `SizeOptPass` | Tail call opt, sequence factoring | — |
| `IndexedAddrPass` | Computed address → indexed addressing | — |
| `ZPPromotionPass` | Hot addresses → zero page | — |

### Codegen (All Levels)

| Component | What It Does | Relevant Themes |
|-----------|-------------|-----------------|
| `bitwise.ts: genShrWord()` | Emits SHR_WORD as 6×(PHA/TXA/LSR/TAX/PLA/ROR) | Theme CG |
| `memory.ts: genLoadAddressExpr()` | Emits `LDA #(label / N)` for assembly-time folding | Theme A |
| `expressions.ts: tryGenerateAddressExpr()` | AST-level detection of `@var / const` pattern | Theme A |

## Gap Analysis

### Gap 1: Label Arithmetic Lost After Inlining (Theme A)

**Current**: `tryGenerateAddressExpr()` detects `@variable / 64` at the AST level and emits `LOAD_ADDRESS_EXPR`. This works perfectly for inline expressions.

**Problem**: When `getSpriteFrame(spriteAddr: word, frameIndex: byte)` takes the address as a parameter, the AST-level optimizer can't see through the function boundary. After inlining, the IL becomes:
```
LOAD_ADDRESS lineFrames → STORE $07/$08 → LOAD $07/$08 → SHR_WORD 6 → LO
```
The connection between LOAD_ADDRESS and SHR_WORD is broken by the parameter slot.

**Fix needed**: IL-level pattern recognition post-inlining.

### Gap 2: No Modulo-to-Bitmask Pattern (Theme C)

**Current**: Increment-compare-reset patterns emit:
```
ADC #1 → STA slot → CMP #N → BNE skip → LDA #0 → STA slot → LABEL skip
```

**Problem**: No IL or ASM pass recognizes this as modulo-N and replaces with AND.

**Fix needed**: IL peephole pattern or ASM peephole pattern.

### Gap 3: Post-Inlining Store/Reload (Theme F)

**Current**: After inlining, every parameter produces:
```
; caller stores arg to callee param slot
STA $07 / STX $08
; inlined callee loads param from slot  
LDA $07 / LDX $08   ← REDUNDANT: value was just stored!
```

**Problem**: The IL peephole's `loadStoreElimination()` handles `STORE_BYTE x; LOAD_BYTE x` but may not handle the word variant, or the pattern may be broken by intermediate instructions after inlining.

**Fix needed**: Extend IL peephole or add inliner post-splice cleanup.

### Gap 4: RegisterPromotePass Not Firing (Theme H)

**Current**: The `RegisterPromotePass` exists and should convert memory-counted loops to register-counted. But the spinning-line delay loop still uses `INC $05 / CMP #$FF / JMP`.

**Problem**: Unknown — needs investigation. Possible causes:
- `barrier()` inside loop blocks analysis
- Pattern uses INC (memory) instead of expected count-down
- Count-up direction doesn't match pass's expected patterns

**Fix needed**: Investigate and fix RegisterPromotePass or add new pattern.

### Gap 5: SHR_WORD Codegen Is Maximally Pessimistic (Theme CG)

**Current**: `genShrWord()` always emits 6 instructions per bit position: `PHA/TXA/LSR/TAX/PLA/ROR`. For shift-by-6, that's 36 instructions.

**Problem**: For large shift counts, entirely different strategies are possible:
- Shift by 8: just `TXA` (1 instruction)
- Shift by ≥8: `TXA` then shift remainder
- Any count: could avoid stack for counts ≤ 2 by using temp ZP

**Fix needed**: Smarter codegen based on shift count.

## Dependencies

### Internal
- Theme F depends on understanding inliner's splice mechanics
- Theme A depends on Theme F (store/reload must be fixed first)
- Theme H is independent (ASM optimizer level)
- Theme CG is independent (codegen level)
- Theme C is independent (IL peephole level)

### External
- No external dependencies
- ACME assembler behavior is fixed and well-understood

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Regression in existing tests | Medium | High | Run full test suite after each change |
| RegisterPromotePass fix breaks other loops | Low | High | Targeted test programs |
| Modulo optimization applied to non-power-of-2 | Low | Critical | Negative test with mod 5 |
| SHR_WORD improvement changes timing-sensitive code | Low | Medium | Only affects instruction selection, not semantics |
