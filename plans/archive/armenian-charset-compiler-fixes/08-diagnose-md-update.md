# Diagnose.md Update: Item L

> **Document**: 08-diagnose-md-update.md
> **Parent**: [Index](00-index.md)
> **Scope**: Four new diagnostic analysis sections for `.clinerules/diagnose.md`
> **File**: `.clinerules/diagnose.md`

## Overview

Item L adds four new analysis techniques to the `diagnose.md` diagnostic protocol. These techniques were identified through the external third-party ASM analysis of the armenian-charset program and fill gaps in the current diagnostic methodology.

These are **tooling improvements** — they make future diagnostics more thorough, catching bugs that the current protocol misses.

---

## New Section 1: Phase 4.9 — Stack Discipline Audit

### Purpose

Verify that every function's PHA/PLA, PHP/PLP, and JSR/RTS pairs are balanced. Unbalanced stack operations cause stack pointer drift, eventual stack overflow, and corrupted return addresses.

### Template

```markdown
### **4.9 Stack Discipline Audit (MANDATORY)**

**🚨 Audit PHA/PLA balance for EVERY function in the assembly output.**

For each function:
1. Count all `PHA` instructions (stack pushes)
2. Count all `PLA` instructions (stack pops)
3. Count all `PHP` instructions (push processor status)
4. Count all `PLP` instructions (pull processor status)
5. Verify: total pushes == total pops on ALL code paths

**Stack balance table template:**

| Function | PHA | PLA | PHP | PLP | Net | Status |
|----------|-----|-----|-----|-----|-----|--------|
| main | 2 | 2 | 0 | 0 | 0 | ✅ |
| copyCharset | 1 | 2 | 0 | 0 | -1 | ❌ BUG |

**What to look for:**
- **Net ≠ 0**: Stack corruption — function leaks or consumes stack bytes
- **PHA without matching PLA**: Pushed value never restored
- **PLA without matching PHA**: Popping unowned stack data
- **Nested loops with PHA/PLA**: Verify balance per iteration, not just per function

**Special attention to for-loops:**
For-loop templates may emit PHA/PLA for counter save/restore during bound comparison.
Verify that EACH iteration has balanced stack operations:
- `PHA (save counter) → compare → PLA (restore)` = balanced per iteration ✅
- `PHA (save counter) → compare → PLA → PLA` = unbalanced per iteration ❌

**Report each imbalance as a `REDUN` or `IL` bug with the exact count discrepancy.**
```

### Integration Point

Add after Phase 4.8 (Strength Reduction & Algebraic Rewrite Audit) in `diagnose.md`.

---

## New Section 2: Phase 4.10 — Canonical 6502 Lowering Comparison

### Purpose

Compare the compiler's code generation for common patterns against canonical 6502 idioms. This catches cases where the compiler produces correct but grossly suboptimal code.

### Template

```markdown
### **4.10 Canonical 6502 Lowering Comparison**

**🚨 Compare compiler output against canonical 6502 idioms for common patterns.**

For each recognized pattern in the assembly output, compare against the canonical
6502 implementation:

#### **Delay Loop Comparison**

| Pattern | Compiler Output | Canonical 6502 | Savings |
|---------|----------------|----------------|---------|
| Simple delay (N iterations) | LOAD/CMP/BCS/INC/JMP (10 bytes) | LDX #N / DEX / BNE (4 bytes) | 6 bytes |
| Nested delay (N×M) | Two generic loops (20 bytes) | LDX/LDY/DEY/BNE/DEX/BNE (8 bytes) | 12 bytes |

#### **Memory Copy Comparison**

| Pattern | Compiler Output | Canonical 6502 | Savings |
|---------|----------------|----------------|---------|
| Block copy (N bytes) | Per-byte peek/poke loop (~30 bytes/iter body) | LDA (src),Y / STA (dst),Y / INY (~25 bytes total) | Dramatic |
| Screen fill (1000 bytes) | Word-indexed indirect (~25 bytes/iter body) | Page-based STA base,X (~15 bytes total) | Dramatic |

#### **Counter Patterns**

| Pattern | Compiler Output | Canonical 6502 | Savings |
|---------|----------------|----------------|---------|
| Byte counter 0-255 | LDA/CMP #256 overflow | LDX/DEX/BNE (3 bytes) | Varies |
| Modulo power-of-2 | Runtime mod call | AND #(N-1) (2 bytes) | Varies |

**For each comparison:**
1. Document the exact compiler output (assembly snippet)
2. Show the canonical 6502 equivalent
3. Calculate byte and cycle savings
4. Classify as `MISSOPT` if the canonical form is achievable by the compiler

**NOTE:** Not all canonical forms are achievable — some require information the compiler
doesn't have (e.g., alignment guarantees). Only report as `MISSOPT` when the compiler
CAN reasonably detect and apply the canonical pattern.
```

### Integration Point

Add after the new Phase 4.9 in `diagnose.md`.

---

## New Section 3: Phase 3.6 — Cross-Level ASM Metrics Table

### Purpose

Provide a quantitative comparison across all 6 optimization levels with line counts, text sizes, and PRG sizes. This makes size regressions immediately visible.

### Template

```markdown
### **3.6 Cross-Level ASM Metrics Table**

**Create a comprehensive metrics table comparing ALL optimization levels.**

**Template:**

| Level | ASM Lines | Text Size (bytes) | PRG Size (bytes) | Delta vs O0 (PRG) | Delta vs O0 (%) |
|-------|-----------|-------------------|-------------------|--------------------|-----------------| 
| O0 | XXX | XXX | XXX | baseline | baseline |
| O1 | XXX | XXX | XXX | +/-N | +/-N% |
| O2 | XXX | XXX | XXX | +/-N | +/-N% |
| O3 | XXX | XXX | XXX | +/-N | +/-N% |
| Os | XXX | XXX | XXX | +/-N | +/-N% |
| Oz | XXX | XXX | XXX | +/-N | +/-N% |

**How to gather metrics:**
1. ASM Lines: `wc -l build/diag/<app>/O0/output.asm` (etc.)
2. Text Size: `wc -c build/diag/<app>/O0/output.asm` (etc.)
3. PRG Size: `ls -la build/diag/<app>/O0/output.prg` (etc.)

**What to look for:**
- **PRG size INCREASE at higher optimization levels**: Always a `REG` or `MISSOPT` bug
- **Os/Oz larger than O1**: Size-focused levels should NEVER be larger than speed-focused
- **O3 significantly larger than O2**: Over-inlining without follow-up optimization
- **All sizes identical**: Optimizer may not be running (check logs)
- **ASM lines decrease but PRG stays same**: Comments removed but code unchanged

**This table is MANDATORY for every diagnostic report.**
```

### Integration Point

Add after Phase 3.5 (Build Cross-Level Behavior Summary Table) in `diagnose.md`.

---

## New Section 4: Phase 8.1 — Regression Test Suggestions

### Purpose

After diagnosing bugs, suggest specific test cases that would have caught the bug earlier and would prevent regression.

### Template

```markdown
### **8.1 Regression Test Suggestions**

**For each bug found in the diagnostic, suggest at minimum 2 regression test cases.**

**Test suggestion template:**

#### Bug: [Bug ID and description]

**Test 1: Minimal reproducer**
```js
// Minimum Blend code that triggers the bug
module test;
export function main(): void {
  // ... minimal code triggering the issue
}
```

**Expected behavior:** [What should happen]
**Actual behavior:** [What currently happens]
**Test type:** Unit / Integration / E2E
**Component:** IL generator / Codegen / Optimizer

**Test 2: Boundary condition**
```js
// Variation testing the boundary of the bug
module test;
export function main(): void {
  // ... boundary condition code
}
```

**Categories of regression tests to suggest:**

| Bug Category | Test Focus |
|-------------|------------|
| Wrong width (byte/word) | Test with values >255 to verify word path |
| Stack corruption | Test function that returns after a loop |
| Register clobbering | Test complex expressions using all registers |
| Missed optimization | Compare O0 vs O2 output for specific pattern |
| ROM shadow | Test with data at $1000 address |

**Include at least:**
- One test for the exact bug scenario
- One test for a related boundary condition
- One test for the inverse (correct behavior that should NOT break)
```

### Integration Point

Add after Phase 8 (Next Steps) in `diagnose.md`.

---

## Implementation Approach

All four sections are additions to `.clinerules/diagnose.md`. They don't modify existing sections — they add new subsections at specific points in the diagnostic protocol.

### Files Changed

| File | Change |
|------|--------|
| `.clinerules/diagnose.md` | Add Phase 3.6, Phase 4.9, Phase 4.10, Phase 8.1 |

### Regression Risk

**None.** These are documentation additions to a diagnostic protocol. No code changes. Existing diagnostic sections are preserved.

### Integration Points Summary

| New Section | Insert After | Section Number |
|------------|-------------|----------------|
| Cross-Level ASM Metrics | Phase 3.5 (Cross-Level Behavior Summary Table) | 3.6 |
| Stack Discipline Audit | Phase 4.8 (Strength Reduction) | 4.9 |
| Canonical 6502 Lowering | Phase 4.9 (Stack Discipline) | 4.10 |
| Regression Test Suggestions | Phase 8 (Next Steps) | 8.1 |

## Testing Strategy

No code tests needed. Validation is:
- [ ] New sections follow existing document style
- [ ] Templates are complete and actionable
- [ ] Section numbering is consistent
- [ ] Cross-references to existing sections are correct
- [ ] No existing content modified or removed
