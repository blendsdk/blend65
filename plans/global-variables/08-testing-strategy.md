# Testing Strategy: Global Variables & Storage Classes

> **Document**: 08-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- Unit tests: Maximum coverage for each new component
- Integration tests: Cross-component interactions
- E2E tests: Complete pipeline from source to binary
- **Target: ~140+ new tests**

## Test Categories

### 1. Parser Validation (~15 tests)

| Test | Description | Priority |
|------|-------------|:--------:|
| `@zp let` at module level | Accepts and sets storageClass | High |
| `@ram let` at module level | Accepts and sets storageClass | High |
| `@data const` at module level | Accepts and sets storageClass | High |
| `@data let` error | Rejects mutable @data | High |
| `@data const` without init | Rejects missing initializer | High |
| `@zp` inside function error | Clear error message | High |
| `@ram` inside function error | Clear error message | High |
| `@data` inside function error | Clear error message | High |
| `export @zp let` | Exported storage class global | Medium |
| `@zp const` | Constant with @zp | Medium |
| Multiple storage classes in one module | All parsed correctly | Medium |
| `@zp` with array type | @zp let ptrs: word | Medium |
| `@data` with large array | 256-element array | Medium |
| `@data` with various literal types | hex, binary, decimal | Medium |
| No storage class (default) | Null storageClass | Low |

### 2. Semantic Analyzer (~15 tests)

| Test | Description | Priority |
|------|-------------|:--------:|
| @zp metadata stored | Symbol has storageClass metadata | High |
| @ram metadata stored | Symbol has storageClass metadata | High |
| @data metadata stored | Symbol has storageClass metadata | High |
| @data const enforced | Error for @data without const | High |
| @data init enforced | Error for @data without initializer | High |
| Exported @zp symbol | GlobalSymbolTable carries address | High |
| Cross-module @zp import | Imported symbol gets ZP address | High |
| Storage class in function scope error | Semantic error (if not caught by parser) | Medium |
| Duplicate @zp declarations | Handled correctly | Medium |
| @zp with void type error | Invalid type for ZP | Medium |
| @data with non-constant init | Error for runtime expressions | Medium |
| @zp word (2 bytes) | Correct size tracking | Medium |
| @ram array | Correct size tracking | Medium |
| @data string literal | String in data segment | Low |
| Multiple modules @zp exports | No address conflicts | Low |

### 3. Global Allocator (~25 tests)

| Test | Description | Priority |
|------|-------------|:--------:|
| Single @zp byte allocation | Gets ZP address | High |
| Single @zp word allocation | Gets 2 consecutive ZP bytes | High |
| Multiple @zp allocations | All get unique addresses | High |
| @ram allocation | Gets RAM region address | High |
| @data allocation | Gets data segment address | High |
| Default global allocation | Gets RAM region address | High |
| ZP pool exhaustion error | Clear error message | High |
| ZP pool sharing (globals then locals) | No address conflicts | High |
| Mixed storage classes | All allocated correctly | High |
| Cross-module @zp consistency | Same address in both modules | High |
| Empty module (no globals) | No errors | Medium |
| Large @data array (256 bytes) | Correct data segment size | Medium |
| Multiple @data blocks | Packed sequentially | Medium |
| @data address calculation | Correct base addresses | Medium |
| @ram + default together | Separate addresses in RAM | Medium |
| Export affects allocation | Exported globals handled | Medium |
| Single @zp fills remaining pool | Locals still work | Medium |
| @zp overflow by 1 byte | Error shows exact numbers | Medium |
| All @zp no locals | Full ZP used by globals | Low |
| ZP pool stats after allocation | Correct available/used | Low |
| Allocation determinism | Same input → same addresses | Low |
| Module ordering effect | Different module order → same result | Low |
| @data total size calculation | Correct aggregate | Low |
| Allocation with 0 available ZP | All @zp fail | Low |
| Allocation result structure | All fields populated | Low |

### 4. IL Generator (~20 tests)

| Test | Description | Priority |
|------|-------------|:--------:|
| @zp global init → STORE to ZP addr | Correct IL | High |
| @ram global init → STORE to RAM addr | Correct IL | High |
| @data global → NO init IL | No STORE instructions | High |
| Load @zp global in expression | LOAD from ZP addr | High |
| Store to @zp global | STORE to ZP addr | High |
| Load @ram global | LOAD from RAM addr | High |
| Store to @ram global | STORE to RAM addr | High |
| Load @data element | LOAD from data addr | High |
| @zp global volatile flag | isVolatile = true | High |
| @data reference (base addr) | LOAD_IMM_WORD addr | High |
| Global + local in same function | Both resolved correctly | Medium |
| Cross-module global reference | Correct address resolution | Medium |
| Global in binary expression | Load + operate + store | Medium |
| Global in function argument | Load before CALL | Medium |
| Global in condition | Load before comparison | Medium |
| Multiple globals in one statement | All loaded correctly | Medium |
| Uninitialized @ram global | Zero-init or no-init | Low |
| Const global (no writes) | No STORE IL for reads | Low |
| Global array indexed access | Indexed load IL | Low |
| Large globalInit block | Many globals initialized | Low |

### 5. Optimizer Protection (~15 tests)

| Test | Description | Priority |
|------|-------------|:--------:|
| Dead global elim skips @zp | @zp global preserved | High |
| Dead global elim skips @data | @data block preserved | High |
| Dead global elim removes @ram | Unused @ram removed | High |
| CSE doesn't cache @zp reads | Re-read on each access | High |
| CSE caches @data reads | Constant folding works | High |
| Volatile flag on @zp load | isVolatile = true | High |
| Volatile flag on @zp store | isVolatile = true | High |
| No volatile flag on @ram | isVolatile = false | Medium |
| No volatile flag on @data | isVolatile = false | Medium |
| LICM doesn't hoist @zp | Loop reads preserved | Medium |
| LICM can hoist @data | Const data hoisted | Medium |
| Dead global elim with mixed | Only @ram removed | Medium |
| @zp init not dead-stored | Initialization preserved | Medium |
| Optimizer regression: existing tests | All 8000+ still pass | High |
| E2E: optimized program with globals | Correct output | Medium |

### 6. Codegen (~20 tests)

| Test | Description | Priority |
|------|-------------|:--------:|
| @zp byte load → LDA $zp | ZP addressing mode | High |
| @zp byte store → STA $zp | ZP addressing mode | High |
| @zp word load → LDA $zp/LDX $zp+1 | ZP word access | High |
| @ram byte load → LDA $abs | Absolute addressing | High |
| @ram byte store → STA $abs | Absolute addressing | High |
| @data array indexed → LDA $abs,X | Indexed absolute | High |
| Data segment in binary | Raw bytes appended | High |
| Data segment address correct | Addresses match layout | High |
| Global init code emitted | Runs before main() | High |
| Mixed ZP + absolute in function | Both modes correct | High |
| @zp word store | Correct byte ordering | Medium |
| @ram word load/store | Absolute word access | Medium |
| Multiple @data blocks in binary | All packed correctly | Medium |
| Large @data array (256 bytes) | Binary size correct | Medium |
| @data address references | Correct pointers | Medium |
| Binary layout: code then data | Correct segment order | Medium |
| Empty data segment | No extra bytes | Low |
| Empty global RAM | No extra allocation | Low |
| Cross-module codegen | Imported @zp uses ZP mode | Low |
| Full pipeline: sprite-test | Complete compilation | High |

### 7. E2E Pipeline (~15 tests)

| Scenario | Description | Priority |
|----------|-------------|:--------:|
| sprite-test.blend | Full compilation succeeds | High |
| @zp game state module | Module with exported @zp vars | High |
| @data sprite data | Large array in data segment | High |
| Multi-module @zp sharing | Import @zp from another module | High |
| border-cycle with globals | Existing example still works | High |
| snake-game examples | Multi-module with globals | Medium |
| ZP overflow error | Clear diagnostic | Medium |
| @data validation errors | @data let, missing init | Medium |
| Mixed storage classes E2E | All types in one program | Medium |
| Optimized build with globals | -O1/-O2 don't break globals | Medium |
| Large program with many globals | Stress test | Low |
| All ZP used by globals | Locals fall back to RAM | Low |
| Empty program (no globals) | No regression | Low |
| Module with only @data | Data-only module | Low |
| Import non-existent global | Error handling | Low |

## Verification Checklist

- [ ] All new unit tests pass
- [ ] All new integration tests pass
- [ ] All new E2E tests pass
- [ ] No regressions in existing 8000+ tests
- [ ] Test coverage meets goals
- [ ] sprite-test.blend compiles and produces valid binary
