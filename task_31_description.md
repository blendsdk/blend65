## Goal
Create foundational 6502 code generation system with comprehensive ACME assembly output, automatic source mapping, CLI integration, and complete Commodore platform support.

## 🔥 ENHANCED SCOPE BASED ON PLANNING SESSION

### **Core Requirements**
- ✅ **6502 Code Generation Infrastructure** (original scope)
- 🆕 **ACME Assembly Output to Disk** (save .asm files with CLI control)
- 🆕 **Automatic Source Mapping Documentation** (built-in source maps using IL metadata)
- 🆕 **Debug Information Integration** (leveraging existing IL debug info)
- 🆕 **CLI-Configurable Options** (all features accessible via command line)
- 🆕 **VICE Emulator Integration** (validation using existing emulator-test package)

### **Platform Support Matrix**
- ✅ **Complete Commodore Family Support**: C64, VIC-20, C128, PET, CBM, Plus/4, C16, X16
- ✅ **Configurable Auto-Run Stubs** (platform-specific BASIC stubs)
- ✅ **Multi-Platform Abstraction** (future-proof architecture)
- ✅ **Smart Default Entry Points** (with override capability)

### **CLI Interface Design**
```bash
# Full feature CLI interface
blend65 compile game.blend \
  --target c64 \
  --optimization none \
  --output-asm game.asm \
  --debug \
  --source-maps \
  --auto-run \
  --entry-point 0x0810 \
  --preserve-asm
```

### **Revolutionary Source Mapping System**
**Leverages existing IL infrastructure for automatic documentation:**

```asm
; ============================================================================
; BLEND65 GENERATED ASSEMBLY - COMPREHENSIVE SOURCE MAPPING
; Source File: game.blend
; Function: main() at line 15
; Generated: 2026-01-05 22:00:00
; ============================================================================

main:
    ; game.blend:17 | var playerX: byte = 100
    ; IL: LOAD_IMMEDIATE playerX, 100
    ; Storage: Zero Page $20
    lda #100            ; Load immediate value 100
    sta $20             ; Store to playerX (zp:$20)
```

**Uses existing IL metadata:**
- ✅ `ILInstruction.sourceLocation` - File, line, column info
- ✅ `ILInstructionMetadata.debugInfo.sourceLine` - Original source code line
- ✅ `ILInstructionMetadata.originalAstNode` - AST node reference

## Dependencies
- ✅ Complete IL system (Phase 2 finished) - 403/403 tests passing
- ✅ Emulator-test package ready for VICE integration

## Implementation Requirements

### **Core Code Generation**
- [ ] 6502 instruction template system for IL mapping
- [ ] Basic register allocation strategy (A, X, Y registers)
- [ ] Memory layout management for Blend65 storage classes
- [ ] Assembly output formatting (ACME assembler compatibility)
- [ ] Integration with IL analytics for optimization-aware generation

### **Platform Abstraction System**
- [ ] **CommodorePlatform** abstract base class
- [ ] **Platform specifications database** with memory maps and entry points:
  ```typescript
  const COMMODORE_PLATFORMS = {
    c64: { basicStart: 0x0801, mlStart: 0x0810, processor: '6510' },
    vic20: { basicStart: 0x1001, mlStart: 0x1010, processor: '6502' },
    c128: { basicStart: 0x0801, mlStart: 0x0810, processor: '8502' },
    pet: { basicStart: 0x0401, mlStart: 0x0410, processor: '6502' },
    cbm: { basicStart: 0x0401, mlStart: 0x0410, processor: '6502' },
    plus4: { basicStart: 0x1001, mlStart: 0x1010, processor: '7501' },
    c16: { basicStart: 0x1001, mlStart: 0x1010, processor: '7501' },
    x16: { basicStart: 0x0801, mlStart: 0x0810, processor: '65C02' }
  };
  ```

### **Auto-Run Stub Generator**
- [ ] **Platform-specific BASIC stubs** for auto-run programs
- [ ] **Configurable entry points** with validation
- [ ] **Multi-platform stub generation** (C64, VIC-20, PET, etc.)

### **CLI Integration**
- [ ] **CodeGenOptions interface** mapping CLI arguments to compiler options:
  ```typescript
  interface CodeGenOptions {
    targetPlatform: 'c64' | 'vic20' | 'c128' | 'pet' | 'cbm' | 'plus4' | 'c16' | 'x16';
    optimizationLevel: 'none' | 'basic' | 'aggressive';

    // Output options
    outputAssemblyFile?: string;
    preserveAssemblyFile: boolean;
    includeDebugInfo: boolean;
    includeSourceMaps: boolean;

    // Platform stub options
    platformStub: {
      include: boolean;
      customEntryPoint?: number;
    };
  }
  ```

### **VICE Emulator Integration**
- [ ] **Integration with existing emulator-test package**
- [ ] **Memory state validation** for generated assembly
- [ ] **Real hardware compatibility testing**
- [ ] **End-to-end validation pipeline**: Blend65 → IL → Assembly → VICE

## Success Criteria
- [ ] IL instructions map to valid 6502 assembly sequences
- [ ] Basic memory allocation for variables and constants
- [ ] Register usage optimization based on IL analytics
- [ ] **Assembly files saved to disk with comprehensive source mapping**
- [ ] **All 8 Commodore platforms supported with correct stubs**
- [ ] **CLI interface fully functional with all options**
- [ ] **VICE validation passing for generated assembly**
- [ ] **Complete source-to-assembly traceability**
- [ ] Assemblable output format for target platforms
- [ ] Foundation for hardware API code generation

## Testing Strategy

### **Unit Testing**
- **Instruction Mapping Tests**: Each IL instruction → 6502 assembly sequence
- **Platform Tests**: All 8 Commodore platforms with correct memory layouts
- **CLI Tests**: All command line options and error handling
- **Source Mapping Tests**: Verify source-to-assembly correlation

### **Integration Testing**
- **IL Analytics Integration**: Optimization-aware generation using IL metadata
- **Emulator-test Integration**: VICE validation of generated programs
- **Multi-platform Testing**: Same program compiled for all supported platforms

### **End-to-End Testing**
```typescript
// Example test: Simple variable assignment with full validation
const ilProgram = createSimpleConstantAssignment(); // var x: byte = 42
const assembly = codeGen.generate(ilProgram);
await validateWithVICE(assembly, [{ address: 0x0400, expectedValue: 42 }]);
```

## Files Modified
```
packages/codegen/
├── src/
│   ├── code-generator.ts                    // Main code generator
│   ├── platform/
│   │   ├── commodore-platform.ts           // Platform abstraction
│   │   ├── platform-factory.ts             // Platform creation
│   │   └── platform-specs.ts               // Platform database
│   ├── instruction-mapping/
│   │   ├── il-to-6502-mapper.ts            // IL → 6502 mapping
│   │   └── addressing-modes.ts             // 6502 addressing mode selection
│   ├── memory/
│   │   ├── memory-layout-manager.ts        // Memory allocation
│   │   └── register-allocator.ts           // A/X/Y register allocation
│   ├── output/
│   │   ├── acme-formatter.ts               // ACME assembly formatting
│   │   ├── source-mapper.ts                // Source mapping generation
│   │   └── stub-generator.ts               // Auto-run stub generation
│   └── cli/
│       └── cli-options-parser.ts           // CLI argument parsing
├── __tests__/
│   ├── code-generator.test.ts              // Main tests
│   ├── platform/                           // Platform-specific tests
│   ├── integration/                        // Integration tests
│   └── end-to-end/                         // Full pipeline tests
└── package.json                            // Package configuration
```

## 6502 Considerations
- **Register allocation impact** for A/X/Y constraints
- **Memory layout implications** for zero page optimization
- **Cycle count optimization** for performance
- **Hardware constraint compliance** across all Commodore platforms
- **Platform-specific optimizations** (C64 vs VIC-20 vs X16)

## Validation Commands
```bash
yarn test packages/codegen                   # Unit tests
yarn test:integration codegen               # Integration tests
yarn test:emulator                          # VICE validation tests
yarn test:multi-platform                    # All platforms
yarn build && yarn test:end-to-end          # Full pipeline
```

## Quality Gates
- [ ] **Build Health**: All packages compile successfully
- [ ] **Test Coverage**: >90% test coverage for all code generation components
- [ ] **VICE Validation**: Generated assembly runs correctly in emulator
- [ ] **Multi-Platform**: All 8 Commodore platforms generate valid code
- [ ] **Performance**: Code generation <100ms for typical programs
- [ ] **CLI Integration**: All command line options functional

## Definition of Done
- [ ] **Implementation complete and tested** with >90% coverage
- [ ] **Code review approved** by team
- [ ] **CI/CD pipeline passes** all quality gates
- [ ] **Documentation updated** with CLI options and platform support
- [ ] **VICE validation working** with memory state checking
- [ ] **Multi-platform support validated** on all 8 Commodore systems
- [ ] **Source mapping system operational** with full traceability
- [ ] **CLI interface complete** with comprehensive options
- [ ] **Foundation enables** all subsequent code generation tasks (3.2-3.5)

## Next Tasks Enabled
- ✅ **Task 3.2**: Basic Instruction Mapping (depends on this infrastructure)
- ✅ **Task 3.3**: Register Allocation and Memory Management
- ✅ **Task 3.4**: Hardware API Code Generation
- ✅ **Task 3.5**: Multi-Platform Code Generation

## Strategic Impact
🎯 **CRITICAL MILESTONE**: This task enables the **FIRST compiled Blend65 programs** (.prg files)!

- **Complete Commodore ecosystem support** (8 platforms)
- **Professional development experience** with comprehensive source mapping
- **Production-ready CLI interface** for command line compilation
- **Real hardware compatibility** through VICE integration
- **Extensible architecture** for future 6502-family platforms
- **Educational value** through transparent source-to-assembly mapping
