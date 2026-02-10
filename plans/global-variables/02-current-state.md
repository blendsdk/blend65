# Current State: Global Variables & Storage Classes

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists (Working)

| Component | File | Status |
|-----------|------|--------|
| Lexer tokenization | `lexer/lexer.ts` | ✅ Tokenizes `@zp`, `@ram`, `@data` |
| Parser declarations | `parser/declarations.ts` | ✅ Parses storage classes at module level |
| Parser statement blocking | `parser/statements.ts` | ✅ Passes `null` for storageClass inside functions |
| AST VariableDecl | `ast/declarations.ts` | ✅ `storageClass: TokenType \| null` + `getStorageClass()` |
| AST transformer | `ast/walker/transformer.ts` | ✅ Preserves storageClass through transforms |
| SFA for function locals | `frame/allocator/` | ✅ Complete ZP scoring + allocation for locals |
| ZP pool management | `frame/allocator/zp-pool.ts` | ✅ Address tracking, allocation, fragmentation |

### What's Partially Working

| Component | File | Gap |
|-----------|------|-----|
| Semantic symbol builder | `semantic/visitors/symbol-table-builder.ts` | Only stores `@zp` metadata, NOT `@ram`/`@data` |
| Frame calculator | `frame/allocator/frame-calculator.ts` | `getZpDirective()` maps ZP/RAM but NOT `@data`; only processes locals |
| Frame enums | `frame/enums.ts` | `ZpDirective` has None/Zp/Ram but NO Data variant |

### What's Missing (Not Implemented)

| Component | File | Gap |
|-----------|------|-----|
| Global variable allocation | N/A | No mechanism to allocate addresses for module-level globals |
| IL for globals | `il/generator/generator.ts` | `generateGlobalInit()` marked "Phase 7c" placeholder |
| IL global references | `il/generator/expressions.ts` | "Not a local variable — placeholder for Phase 7c" |
| Codegen global addressing | `codegen/generator/base.ts` | Crashes: "Expected address operand, got undefined" |
| Data segment | N/A | No concept of data segment in output |
| Optimizer protection | `optimizer/passes/dead-global-elim.ts` | No `@zp`/`@data` protection |
| Cross-module ZP | `semantic/global-symbol-table.ts` | Doesn't carry ZP addresses |
| Language spec | `docs/language-specification-v2/03-variables.md` | Doesn't document `@data` or global allocation |

## Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `frame/enums.ts` | ZpDirective enum | Add `Data` variant |
| `frame/allocator/frame-allocator.ts` | SFA orchestrator | Extend for global allocation |
| `frame/allocator/frame-calculator.ts` | Frame size calc | Add global slot creation |
| `semantic/visitors/symbol-table-builder.ts` | Symbol registration | Store ALL storage class metadata |
| `semantic/global-symbol-table.ts` | Cross-module symbols | Carry allocated addresses |
| `il/generator/generator.ts` | IL generation | Complete `generateGlobalInit()` |
| `il/generator/expressions.ts` | Expression IL | Global variable load/store |
| `il/generator/base.ts` | IL base utilities | Global slot resolution |
| `codegen/generator/base.ts` | Codegen base | Global addressing modes |
| `optimizer/passes/dead-global-elim.ts` | Dead global removal | Add @zp/@data protection |
| `pipeline/frame-phase.ts` | Pipeline frame phase | Integrate global allocation |
| `docs/language-specification-v2/03-variables.md` | Language spec | Document storage classes fully |

## Dependencies

### Internal Dependencies

- Parser (DONE) → Semantic → Frame Allocator → IL Generator → Optimizer → Codegen
- Each phase depends on the previous being complete for globals

### External Dependencies

- **optimizer-v2 Phase 4** must be complete before starting this plan
- No external package dependencies

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|:----------:|:------:|------------|
| ZP pool conflicts (globals vs locals) | Medium | High | Allocate globals first, locals get remaining |
| Large `@data` arrays overflow binary | Low | High | Size validation during compilation |
| Cross-module ZP address mismatch | Medium | High | Single global allocation pass for all modules |
| Optimizer regression on existing tests | Low | High | Run full test suite after each change |
| IL instruction set may need new opcodes | Medium | Medium | Design IL extension carefully |
