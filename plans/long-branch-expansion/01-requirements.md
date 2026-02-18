# Requirements: Long-Branch Expansion Pass

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Implement an ASM-IL optimizer pass that detects conditional branch instructions whose targets may be out of the 6502's ±127 byte range and expands them into an inverted-branch + JMP pattern that has no range limitation.

## Functional Requirements

### Must Have

- [ ] Detect all conditional branches (BCS, BCC, BEQ, BNE, BMI, BPL, BVC, BVS) with label targets
- [ ] Estimate byte distance between a branch instruction and its target label within the same section
- [ ] Expand branches where estimated distance exceeds threshold (100 bytes) into inverted-branch + JMP + skip-label
- [ ] Generate unique skip labels that don't collide with any existing labels
- [ ] Run at ALL optimization levels (O1 through O3z) as the LAST asm-il pass
- [ ] Not expand branches that are within safe range (preserve short branches for efficiency)
- [ ] Handle both forward and backward branches

### Should Have

- [ ] Use a more accurate byte-size estimation based on addressing mode (1-3 bytes per instruction)
- [ ] Report statistics (patterns matched, bytes added) via standard AsmPassTransformStats

### Won't Have (Out of Scope)

- Exact byte-distance calculation (would require a full assembler pass — ACME handles this)
- Modification of IL-level codegen (fix is at ASM-IL level only)
- Changes to the branch-opt pass (it already handles the inverse transformation correctly)

## Technical Requirements

### Correctness

- The expansion must preserve program semantics exactly — same control flow behavior
- Inverted branch + JMP is semantically identical to the original branch
- Skip labels must be locally unique per section

### Performance

- Pass runs in O(n) time per section (single scan of elements)
- No overhead at runtime for branches that are NOT expanded
- Expanded branches cost +3 bytes and +3 cycles (the JMP) compared to a short branch

### Safety

- The pass must never expand a branch that is within safe range at levels where branch-opt runs, because branch-opt Pattern 3 would collapse it back, creating an infinite optimization loop
- Solution: Run this pass AFTER branch-opt, and only expand when distance > threshold (100 bytes), while branch-opt collapses when distance ≤ 127 bytes. The gap (100-127) is the safety margin.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Fix location | Codegen vs ASM-IL pass | ASM-IL pass | More general, works for all branch types, non-invasive |
| Distance estimation | Count elements × 2 vs per-mode sizing | Count elements × 2 (conservative) | Simpler, safer, no false negatives |
| Threshold | 80, 100, or 120 bytes | 100 bytes | Good balance: avoids false expansions, catches all real issues |
| Pass order | Before branch-opt vs After | After (LAST) | Prevents fight with branch-opt Pattern 3 |

## Acceptance Criteria

1. [ ] `diag_app examples/armenian-charset/main.blend` passes at ALL 10 optimization levels
2. [ ] Unit tests cover: short branches NOT expanded, long branches expanded, all 8 branch types
3. [ ] No existing tests regress (full `./compiler-test` passes)
4. [ ] Pass integrated into pass-factory for all O1+ levels
5. [ ] Branch-opt and long-branch-expansion don't fight (no infinite loops)
