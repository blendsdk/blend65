# Testing Strategy: Long-Branch Expansion Pass

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- Unit tests: 100% coverage of the pass's public/protected methods
- Integration tests: Verify pass works in the optimizer pipeline
- E2E tests: Verify armenian-charset compiles at O2/O3

## Test Categories

### Unit Tests

File: `__tests__/codegen/asm-il/optimizer/passes/long-branch-expansion.test.ts`

| Test | Description | Priority |
|------|-------------|----------|
| Short branch NOT expanded | BCS with target 20 instructions away stays as BCS | High |
| Long forward branch expanded | BCS with target 80+ instructions away becomes BCC + JMP | High |
| Long backward branch expanded | BNE targeting a label 80+ instructions before becomes BEQ + JMP | High |
| All 8 branch types | BCS→BCC, BCC→BCS, BEQ→BNE, BNE→BEQ, BMI→BPL, BPL→BMI, BVC→BVS, BVS→BVC | High |
| Skip label is unique | Multiple expansions in same section get different skip labels | Medium |
| Skip label is local | Generated labels start with `.` | Medium |
| Target not found | Branch to label not in section — no expansion, no crash | Medium |
| Multiple sections | Each section processed independently | Medium |
| No branches in section | Pass returns unchanged program | Low |
| Mixed short and long | Only long branches expanded, short ones preserved | High |
| Stats reported correctly | patternsMatched, instructionsAdded, estimatedBytesSaved | Medium |
| Byte estimation accuracy | Test estimateInstructionBytes for each addressing mode | Medium |

### Integration Tests

| Test | Components | Description |
|------|------------|-------------|
| Pipeline integration | Pass factory + optimizer | Verify pass is created and runs at O2 level |
| No regression at O0 | Pass factory | Verify pass is NOT created at O0 |
| Runs after branch-opt | Pass factory ordering | Verify long-branch-expansion is last in pass list |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Armenian charset O2 | Compile `examples/armenian-charset/main.blend` at O2 | Assembly succeeds (ACME produces .prg) |
| Armenian charset O3 | Compile at O3 | Assembly succeeds |
| Large loop body | For-loop with 70+ instructions in body | BCS endfor expanded to BCC skip + JMP endfor |
| Small loop body | For-loop with 10 instructions in body | BCS endfor NOT expanded (stays as BCS) |

## Test Data

### Fixtures Needed

**Helper function for creating test programs with N instructions:**
```typescript
function createSectionWithBranch(
  branchMnemonic: string,
  targetLabel: string,
  instructionCount: number
): AsmILSection {
  const elements: AsmILElement[] = [];
  // Add branch instruction
  elements.push({
    kind: 'instruction',
    instruction: {
      mnemonic: branchMnemonic,
      mode: AsmAddressingMode.Relative,
      labelOperand: targetLabel,
    },
  });
  // Add N filler instructions (2 bytes each — LDA #imm)
  for (let i = 0; i < instructionCount; i++) {
    elements.push({
      kind: 'instruction',
      instruction: {
        mnemonic: 'LDA',
        mode: AsmAddressingMode.Immediate,
        operand: i & 0xFF,
      },
    });
  }
  // Add target label
  elements.push({
    kind: 'label',
    label: { name: targetLabel, isLocal: true },
  });
  return { name: 'code', elements };
}
```

### Mock Requirements

- No mocks needed — uses real AsmILProgram structures
- Helper functions create valid section fixtures

## Verification Checklist

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] No regressions in existing tests (`./compiler-test`)
- [ ] `diag_app examples/armenian-charset/main.blend` passes at all 10 levels
