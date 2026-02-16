# Blend65 Application Diagnostic Protocol

## **TRIGGER KEYWORD: `diag_app`**

When the user types `diag_app <path-to-blend-file>`, execute this comprehensive diagnostic workflow to identify compiler bugs, optimization regressions, and assembly errors.

---

## **Overview**

This protocol automates the full diagnostic pipeline:

1. **Compile** a Blend application at all 6 optimization levels (O0–Oz)
2. **Assemble** each output with ACME to produce `.prg` binaries
3. **Diff** assembly output across optimization levels
4. **Analyze** all compiler/assembler logs and generated assembly
5. **Diagnose** the root cause and classify the bug
6. **Report** findings with evidence and recommended next steps

---

## **Phase 1: Run the Diagnostic Script**

### **1.1 Execute `diag_app.sh`**

**IMMEDIATELY run the diagnostic script:**

```bash
clear && ./scripts/diag_app.sh <path-to-blend-file>
```

**Example:**
```bash
clear && ./scripts/diag_app.sh examples/spinning-line/main.blend
```

The script will:
- Build the compiler (`yarn build`)
- Compile at O0, O1, O2, O3, Os, Oz
- Run ACME on each `.asm` output to produce `.prg` files
- Generate an O0-debug build with inline source comments
- Create diffs between O0 and all other optimization levels
- Produce a `summary.txt` with pass/fail results and file sizes

### **1.2 Note the Output Directory**

The script outputs to `build/diag/<app-name>/` by default. Remember this path — all analysis files will be here.

---

## **Phase 2: Review Language Specification**

### **2.1 Read Relevant Language Specification Sections**

**BEFORE analyzing any source code or compiler output, ALWAYS read the language specification first.**

This is MANDATORY — you cannot properly diagnose source code issues without understanding what valid Blend code looks like.

**Read these specification files based on what the source code uses:**

| Feature Used in Source | Specification File |
|------------------------|--------------------|
| Module declarations | `docs/language-specification-v2/07-modules.md` |
| Variable declarations (`let`, `const`) | `docs/language-specification-v2/03-variables.md` |
| Types (`byte`, `word`, `bool`, arrays) | `docs/language-specification-v2/02-types.md` |
| Expressions (arithmetic, comparison, etc.) | `docs/language-specification-v2/04-expressions.md` |
| Statements (`if`, `while`, `for`, `return`) | `docs/language-specification-v2/05-statements.md` |
| Functions | `docs/language-specification-v2/06-functions.md` |
| Intrinsics (`poke`, `peek`, `lo`, `hi`, etc.) | `docs/language-specification-v2/08-intrinsics.md` |
| Asm functions | `docs/language-specification-v2/09-asm-functions.md` |
| Storage classes (`@zp`, `@ram`, `@data`, `@sprite`, etc.) | `docs/language-specification-v2/03-variables.md` |
| Compiler directives | `docs/language-specification-v2/10-compiler.md` |
| Lexical structure (comments, literals, etc.) | `docs/language-specification-v2/01-lexical-structure.md` |

### **2.2 Minimum Specification Reading**

**At a minimum, ALWAYS read:**
1. `docs/language-specification-v2/README.md` — Overview and table of contents
2. Any section relevant to features used in the source code

### **2.3 Build a Mental Model**

After reading the specification, you should be able to answer:
- What are valid types and their sizes?
- What operators are supported and their precedence?
- What are the rules for variable declarations and storage classes?
- What intrinsics are available and their signatures?
- What are the rules for function declarations and calls?
- What are the valid statement forms?

**This knowledge is ESSENTIAL for Phase 4 (Source Code Analysis).**

---

## **Phase 3: Read and Analyze the Summary**

### **3.1 Read the Summary File**

```
Read: build/diag/<app-name>/summary.txt
```

### **3.2 Classify the Overall Result**

| Result | Meaning |
|--------|---------|
| ✅ All PASS | Compilation and assembly succeed at all levels |
| ❌ Blend65 FAIL at some levels | Compiler crashes or produces errors |
| ❌ ACME FAIL at some levels | Compiler output is syntactically invalid assembly |
| ❌ Only O0 passes, higher fails | Optimization regression bug |
| ❌ All levels FAIL | Fundamental compiler bug or invalid source code |

### **3.3 Check File Size Anomalies**

Review the PRG sizes in the summary:
- **Sudden size increase** at a level → possible dead code not eliminated
- **Sudden size decrease** at a level → possible code incorrectly eliminated
- **Size of 0** → compilation or assembly failure
- **All sizes identical** across O0–O3 → optimizer may not be running

---

## **Phase 4: Investigate Failures**

### **4.1 For Blend65 Compilation Failures**

Read the compiler log for the failing level:

```
Read: build/diag/<app-name>/<level>/blend65.log
```

**Look for:**
- Syntax errors → likely a `.blend` source code bug
- Type errors → likely a `.blend` source code bug or missing type support
- Internal compiler errors / stack traces → **compiler bug**
- "not implemented" messages → missing compiler feature

### **4.2 For ACME Assembly Failures**

Read both the ACME log AND the generated assembly:

```
Read: build/diag/<app-name>/<level>/acme.log
Read: build/diag/<app-name>/<level>/output.asm
```

**Look for:**
- "Undefined label" → compiler generated a reference to a non-existent label
- "Out of range" → branch target too far (codegen needs JMP instead of branch)
- "Syntax error" → compiler generated invalid ACME syntax
- "Duplicate label" → compiler emitted the same label twice
- "Value out of range" → 16-bit value used where 8-bit expected

### **4.3 For Optimization Regressions**

When O0 passes but higher levels fail, read the diff:

```
Read: build/diag/<app-name>/diffs/O0-vs-<failing-level>.diff
```

**The diff reveals exactly what the optimizer changed.** Look for:
- Removed instructions that shouldn't be removed (over-aggressive dead code)
- Reordered code that breaks control flow
- Missing labels after optimization
- Incorrect register reuse
- Broken inlined function code

### **4.4 Use the Debug Build for Context**

The O0 debug build includes inline source comments showing which Blend statement generated which assembly:

```
Read: build/diag/<app-name>/O0/output-debug.asm
```

This maps assembly back to source code — invaluable for understanding what the compiler intended.

### **4.5 Assembly Quality Audit (MANDATORY — Even When All Levels Pass)**

**🚨 This step is NON-OPTIONAL.** Even when all 6 levels compile and assemble successfully, you MUST audit the generated assembly for code quality bugs. "All levels pass" only means there are no compilation/assembly failures — it does NOT mean the compiler produced optimal code.

**Read the assembly output at EVERY optimization level:**

```
Read: build/diag/<app-name>/O0/output.asm
Read: build/diag/<app-name>/O1/output.asm   (or higher levels)
Read: build/diag/<app-name>/Os/output.asm
```

**Check for these specific patterns — each one is a bug:**

#### **Redundant Store/Reload Patterns (REDUN)**

The compiler stores a value to memory and immediately reloads it without any intervening change:

```asm
; BUG: Redundant store/reload — value is already in A/X
  STA $07       ; store parameter
  STX $08
  LDA $07       ; immediately reload — WASTED 4+ cycles
  LDX $08
```

**This is a bug.** The value was already in the registers. The store/reload pair is dead code.

#### **Jump-to-Next-Instruction Patterns (REDUN)**

The compiler emits a jump whose target is the very next instruction:

```asm
; BUG: Jump to next instruction — 3 bytes + 3 cycles wasted
  JMP .label
.label:
```

**This is a bug.** The JMP is a no-op. Control would fall through naturally.

#### **Dead Code After Unconditional Jumps (REDUN)**

Instructions between an unconditional jump/return and the next reachable label:

```asm
  JMP .somewhere
  LDA #$00       ; BUG: Dead code — never executed
  STA $FF        ; BUG: Dead code — never executed
.nextLabel:
```

#### **Redundant Register Loads (REDUN)**

Loading a value into a register when it already contains that value:

```asm
  LDA #$00       ; Load 0 into A
  STA $06        ; Store it
  LDA #$00       ; BUG: A already contains 0
```

#### **Unnecessary Parameter Shuffling During Inlining (REDUN)**

When a function is inlined, the compiler may still store parameters to memory slots and reload them, even though the values are already in registers:

```asm
; @lineFrames — value loaded into A/X
  LDA #<__data_label
  LDX #>__data_label
; [inlined] param spriteAddr (word) — stores to slots
  STA $07
  STX $08
; [inlined] load spriteAddr (word) — reloads from slots
  LDA $07        ; BUG: Value was already in A!
  LDX $08        ; BUG: Value was already in X!
```

**This is a bug.** Inlining should eliminate parameter passing overhead, not preserve it.

#### **Redundant Loads Before Comparison (REDUN)**

Loading a value that was just stored (and is still in the accumulator):

```asm
  STA $06        ; Store frame value
; load frame
  LDA $06        ; BUG: Value is already in A from the STA above
  CMP #$04
```

#### **Missing Peephole Optimizations at Os/Oz (MISSOPT)**

Size-optimizing levels (Os, Oz) MUST catch simple peephole patterns. If Os/Oz still contains redundant instructions that a basic peephole pass would remove, that is a `MISSOPT` bug.

#### **How to Report Assembly Quality Bugs**

For each pattern found, report it as a separate bug with:
- **Category**: `REDUN` or `MISSOPT`
- **Severity**: High
- **Affected Levels**: Which optimization levels exhibit the issue
- **Evidence**: The exact assembly snippet showing the redundancy
- **Wasted Resources**: Bytes wasted + cycles wasted per occurrence
- **Location in Hot Path**: Is this inside a loop? (affects real-world impact)

---

## **Phase 5: Source Code Analysis**

### **5.1 Read All Source Files**

The diagnostic script copies all `.blend` source files to:

```
Read: build/diag/<app-name>/sources/
```

Read **every** `.blend` file in the sources directory.

### **5.2 Analyze Source Against Language Specification**

Using the language specification knowledge from Phase 2, perform a **thorough code review** of the `.blend` source code. Check for:

**Syntax & Structure Issues:**
- Is the `module` declaration correct?
- Are all statements properly terminated?
- Are block structures (`if`, `while`, `for`) properly formed?
- Is there a valid `export function main(): void` entry point?

**Type System Issues:**
- Are all variable types valid (`byte`, `word`, `bool`, `byte[]`, `word[]`)?
- Are type sizes correct for the intended use? (e.g., `byte` for values > 255)
- Are type conversions explicit where required? (e.g., `lo()` for word→byte)
- Do function return types match the actual return values?
- Are function parameter types correct at call sites?

**Expression & Operator Issues:**
- Are arithmetic operations valid for the operand types?
- Could any expressions overflow? (e.g., `byte + byte` exceeding 255)
- Are comparison operators used correctly?
- Is operator precedence as the programmer intended? (may need parentheses)
- Are bitwise operations used on appropriate types?

**Memory & Hardware Issues:**
- Are `poke`/`peek` addresses valid C64 hardware registers?
- Are `@data` and `@sprite` arrays properly sized?
- Are `poke`/`peek` addresses within valid ranges ($0000–$FFFF)?
- Is sprite data exactly 63 bytes per frame (+1 padding = 64)?
- Are VIC-II register values correct?

**Control Flow Issues:**
- Can `for` loops overflow their counter type? (e.g., `byte` counter to 256)
- Are `while(true)` infinite loops intentional and correct?
- Do all code paths return a value when the function has a return type?
- Are `break` statements used correctly within loops?

**Logic & Algorithm Issues:**
- Does the program logic achieve the intended behavior?
- Are array indices within bounds?
- Are animation frame counts and indices correct?
- Is the delay/timing logic reasonable for C64 speed?

### **5.3 Cross-Reference Source with Assembly**

Use the debug build (`output-debug.asm`) to trace:
- Which source line produced which assembly instruction
- Whether the compiler's interpretation of the source is correct
- Whether type narrowing or promotion happened correctly

### **5.4 Document Source Code Findings**

For each issue found in the source code, document:

1. **File and location** — Which `.blend` file and approximate line
2. **Issue description** — What is wrong or suspicious
3. **Specification reference** — Which language spec section defines the correct behavior
4. **Impact** — Does this cause the compilation/assembly failure?
5. **Suggested fix** — Exact code change to fix the issue

**Example finding:**
```
Issue: Variable `counter` declared as `byte` but used in loop `for counter = 0 to 300`
Location: main.blend, line 42
Spec Reference: docs/language-specification-v2/02-types.md (byte range: 0-255)
Impact: Loop counter overflow — byte cannot reach 300
Suggested Fix: Change type to `word`: `let counter: word = 0;`
```

---

## **Phase 6: Diagnose and Classify**

### **6.1 Bug Classification**

Classify each issue into ONE of these categories. **A single diagnostic may report MULTIPLE bugs.**

| Category | Code | Description | Severity |
|----------|------|-------------|----------|
| **Source Code Bug** | `SRC` | The `.blend` code has a programming error | Critical |
| **Compiler Frontend Bug** | `FE` | Lexer, parser, or semantic analysis is wrong | Critical |
| **IL Generation Bug** | `IL` | Intermediate language generation is incorrect | Critical |
| **Optimizer Bug** | `OPT` | Optimization pass introduces incorrect code | Critical |
| **Code Generation Bug** | `CG` | 6502 assembly generation is wrong | Critical |
| **Emitter Bug** | `EMIT` | ACME syntax emission is malformed | Critical |
| **Optimization Regression** | `REG` | Works at O0 but fails at higher level | Critical |
| **Redundant Code Bug** | `REDUN` | Compiler emits unnecessary/dead instructions | High |
| **Missed Optimization Bug** | `MISSOPT` | Optimizer fails to apply an optimization it should | High |

**Severity Rules:**
- **Critical** — Incorrect behavior: wrong output, crashes, assembly failures, broken semantics
- **High** — All code quality issues: redundant instructions, missed optimizations, wasted cycles/bytes

**🚨 There is NO "Medium" or "Low" severity.** If the compiler emits a single redundant instruction, that is a **High** severity bug. The compiler's job is to produce correct AND efficient code. Any failure in either dimension is a bug that must be reported.

### **6.2 Evidence Requirements**

For each diagnosis, provide:

1. **Category** — One of the codes above
2. **Affected Levels** — Which optimization levels are affected
3. **Root Cause** — Specific explanation of what went wrong
4. **Evidence** — Concrete log excerpts, assembly snippets, or diff sections
5. **Location** — Which compiler source file(s) likely contain the bug
6. **Severity** — Critical / High (see severity rules in 6.1)

### **6.3 Diagnosis Decision Tree**

```
Does it compile at O0?
├── NO → Is the .blend source valid?
│   ├── YES → Compiler Frontend Bug (FE) or IL Bug (IL)
│   └── NO → Source Code Bug (SRC) — fix the .blend code
│
└── YES → Does ACME assemble at O0?
    ├── NO → Code Generation Bug (CG) or Emitter Bug (EMIT)
    │
    └── YES → Does it work at higher levels?
        ├── YES at all levels → Audit assembly quality (Phase 4.5)
        │   ├── Assembly is clean → No bugs found ✅
        │   └── Redundancies found → REDUN and/or MISSOPT bugs
        └── NO at some levels → Optimization Regression (REG)
            └── Read the diff to find what the optimizer broke
```

**🚨 CRITICAL: "All levels pass" does NOT mean "no bugs."** It means there are no compilation or assembly failures. You MUST still perform the assembly quality audit (Phase 4.5) to check for redundant code, missed optimizations, and other code quality issues. These are REAL bugs that must be reported.

---

## **Phase 7: Generate Diagnostic Report**

### **7.1 Report Format**

Present the diagnosis using this format:

```markdown
## 🔍 Diagnostic Report: <app-name>

### Summary
| Item | Value |
|------|-------|
| Application | <app-name> |
| Entry File | <path> |
| Bug Category | <category code and name> |
| Affected Levels | <list of failing levels> |
| Severity | <Critical/High> |

### Source Code Analysis
<Summary of source code review findings>
- ✅ Valid syntax and structure
- ✅ / ❌ Type usage correct
- ✅ / ❌ Memory addresses valid
- ✅ / ❌ Control flow correct
- ✅ / ❌ Logic and algorithms correct

<If source code issues found:>
#### Source Code Issues
| # | File | Issue | Impact | Fix |
|---|------|-------|--------|-----|
| 1 | main.blend | <description> | <impact> | <fix> |
| 2 | ... | ... | ... | ... |

### Diagnosis
<Detailed explanation of the root cause>

### Evidence
<Log excerpts, assembly snippets, diff sections>

### Affected Compiler Code
<List of compiler source files that likely need fixing>
<Or "N/A — source code bug" if category is SRC>

### Recommended Fix
<Specific steps to fix the bug>
<If SRC: provide the exact .blend code changes needed>

### Suggested Plan
<Whether to create a formal plan via `make_plan` or a quick fix>
```

### **7.2 When Source Code Bug is Found (SRC)**

If the `.blend` source code is the problem:

```markdown
## 🔍 Diagnostic Report: <app-name> — Source Code Bug

### Source Code Issues Found
| # | File | Line | Issue | Spec Reference |
|---|------|------|-------|----------------|
| 1 | main.blend | ~42 | byte overflow in loop counter | 02-types.md |

### Suggested Source Code Fix
\`\`\`js
// BEFORE (buggy):
let counter: byte = 0;
for (counter = 0 to 300) { ... }

// AFTER (fixed):
let counter: word = 0;
for (counter = 0 to 300) { ... }
\`\`\`

### Next Step
Fix the source code and re-run: `diag_app <path-to-blend-file>`
```

### **7.3 When No Bug is Found**

If all levels pass AND the assembly quality audit (Phase 4.5) finds NO redundant patterns:

```markdown
## ✅ Diagnostic Report: <app-name>

All 6 optimization levels compiled and assembled successfully.

### Source Code Analysis
✅ Source code reviewed — no issues found

### Assembly Quality Audit
✅ Assembly audited at all optimization levels — no redundant code found

### Assembly Comparison
- O0: <lines> lines, <prg-size> bytes
- O3: <lines> lines, <prg-size> bytes (delta: <diff>)

### Recommendation
No action needed — compiler produced clean, efficient code at all levels.
```

**🚨 IMPORTANT:** This clean report should ONLY be used when:
1. All 6 levels compile and assemble successfully
2. The assembly quality audit (Phase 4.5) found ZERO redundant patterns
3. No dead code, no wasted instructions, no jump-to-next patterns

**If ANY redundant pattern is found, this template MUST NOT be used.** Instead, report each redundancy as a `REDUN` or `MISSOPT` bug using the standard report format from 7.1.

---

## **Phase 8: Next Steps**

Based on the diagnosis:

| Category | Action |
|----------|--------|
| `SRC` | Provide the exact `.blend` code fix, then user re-runs `diag_app` to verify |
| `FE` | Create a plan to fix the compiler frontend |
| `IL` | Create a plan to fix IL generation |
| `OPT` | Create a plan to fix the optimization pass |
| `CG` | Create a plan to fix code generation |
| `EMIT` | Create a plan to fix the ACME emitter |
| `REG` | Create a plan with O0-vs-failing-level diff analysis |
| `REDUN` | Create a plan to add/improve peephole optimization or inlining cleanup |
| `MISSOPT` | Create a plan to fix the optimizer pass that should have caught this |

**For source code bugs (`SRC`):**
1. Provide the exact fix with before/after code
2. Ask the user to apply the fix
3. Suggest re-running `diag_app` to verify the fix resolved the issue

**For compiler bugs:** Ask the user if they want to `make_plan` for the fix.

---

## **Quick Reference**

### Script Usage
```bash
# Default output directory
./scripts/diag_app.sh examples/spinning-line/main.blend

# Custom output directory
./scripts/diag_app.sh examples/balloon-sprite/main.blend build/diag/balloon
```

### Output Structure
```
build/diag/<app-name>/
├── sources/              # .blend source files
├── O0/
│   ├── output.asm        # Assembly (no optimization)
│   ├── output-debug.asm  # Assembly with source comments
│   ├── output.prg        # ACME binary
│   ├── blend65.log       # Compiler log
│   └── acme.log          # Assembler log
├── O1/ ... O2/ ... O3/ ... Os/ ... Oz/
├── diffs/
│   ├── O0-vs-O1.diff
│   ├── O0-vs-O2.diff
│   └── ...
└── summary.txt
```

### Key Files to Read (in order)
1. `summary.txt` — Overall pass/fail and sizes
2. Failed `blend65.log` or `acme.log` — Error details
3. `diffs/O0-vs-<level>.diff` — What the optimizer changed
4. `O0/output-debug.asm` — Source-to-assembly mapping
5. `sources/*.blend` — Original source code

---

## **Integration with Other Rules**

This diagnostic protocol:
- ✅ Follows `.clinerules/agents.md` for shell commands (`clear &&` prefix)
- ✅ Uses `yarn build` (never npm) per Rule 1
- ✅ Creates no inline debug scripts per Rule 10
- ✅ Follows `.clinerules/specification-compliance.md` for language feature verification
- ✅ Can trigger `make_plan` for compiler bug fixes

---

## **Trigger Variations**

| Trigger | Behavior |
|---------|----------|
| `diag_app <file>` | Full diagnostic (this protocol) |
| `diag_app <file> <output-dir>` | Full diagnostic with custom output directory |

---

## **Success Criteria**

The diagnostic is complete when:

1. ✅ Script has been run and all output captured
2. ✅ Language specification reviewed for relevant features
3. ✅ Summary has been read and analyzed
4. ✅ Source code analyzed against language specification
5. ✅ All failures have been investigated with evidence
6. ✅ Bug has been classified into exactly one category
7. ✅ Diagnostic report has been presented to the user
8. ✅ Next steps have been recommended
