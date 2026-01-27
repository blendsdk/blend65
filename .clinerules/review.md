# Project Review Protocol

## **TRIGGER KEYWORD: `review_project`**

When the user types "review_project", execute this **COMPREHENSIVE, DEEP PROJECT REVIEW**. This is NOT a quick review - this is a thorough, exhaustive analysis of the entire project state.

---

## **🚨 CRITICAL: NO SHORTCUTS, NO HALF-MEASURES 🚨**

This review process MUST be:
- **THOROUGH** - Every component analyzed
- **ACCURATE** - Based on actual test runs and code inspection
- **COMPLETE** - All plans, gaps, and todos identified
- **ACTIONABLE** - Clear priorities and next steps

**Split this review into multiple sessions if needed to ensure completeness.**

---

## **Phase 1: Test Suite Analysis (MANDATORY FIRST STEP)**

### **1.1 Run Full Test Suite**

```bash
clear && ./compiler-test
```

**Capture and analyze:**
- Total tests count
- Passing tests count
- Failing tests count
- Skipped tests count
- Pass rate percentage

### **1.2 Categorize Test Results**

Create a breakdown by component:

| Component | Total | Pass | Fail | Skip | Rate |
|-----------|-------|------|------|------|------|
| Lexer | | | | | |
| Parser | | | | | |
| AST | | | | | |
| Semantic | | | | | |
| IL Generator | | | | | |
| Code Generator | | | | | |
| E2E | | | | | |
| Integration | | | | | |

### **1.3 Analyze Failures**

For each failing test:
1. Identify the root cause category (implementation gap, test bug, regression)
2. Link to relevant plan if one exists
3. Prioritize by impact

### **1.4 Document Skipped Tests**

For each skipped test:
1. Why is it skipped?
2. What's blocking it?
3. Is there a plan to fix it?

---

## **Phase 2: Plan Status Audit**

### **2.1 Inventory All Plans**

List every folder in `plans/` (excluding `plans/archive/`):

```
plans/
├── [plan-folder-1]/
├── [plan-folder-2]/
├── ...
```

### **2.2 For EACH Plan, Analyze:**

**Read the following files (if they exist):**
- `00-index.md` - Overview and scope
- `01-requirements.md` - What it's trying to achieve
- `99-execution-plan.md` - Task checklist

**Determine status:**

| Status | Criteria |
|--------|----------|
| ✅ **COMPLETE** | All tasks done, tests passing, feature working |
| 🔄 **IN PROGRESS** | Some tasks done, work ongoing |
| 📋 **NOT STARTED** | Plan exists but no implementation |
| ⚠️ **OUTDATED** | Plan doesn't match current implementation |
| 🗑️ **OBSOLETE** | No longer needed/relevant |

### **2.3 Create Plan Status Table**

| Plan | Status | Completion | Notes |
|------|--------|------------|-------|
| `array-return-types/` | | | |
| `call-void-and-length-gap/` | | | |
| `e2e-codegen-testing/` | | | |
| `end-to-end/` | | | |
| `go-intrinsics/` | | | |
| `il-generator/` | | | |
| `multiple-fixes/` | | | |
| `optimizer/` | | | |
| `features/` | | | |
| `native-assembler/` | | | |

### **2.4 Identify Plans to Archive**

Plans that are **COMPLETE** should be moved to `plans/archive/`.

### **2.5 Identify Plans Needing Revision**

Plans marked **OUTDATED** need to be updated to match current state.

---

## **Phase 3: Implementation Verification**

### **3.1 Cross-Reference Plans with Code**

For each active plan:
1. Read the technical specifications
2. Find the relevant source files
3. Verify implementation matches specification
4. Note any deviations

### **3.2 Find Undocumented Features**

Search for features implemented but NOT in any plan:
- New files added without plan documentation
- Bug fixes that aren't tracked
- Features added ad-hoc

### **3.3 Find Unimplemented Specifications**

Search for specifications NOT yet implemented:
- Planned features still pending
- Partially implemented features
- Stubs or placeholders in code

---

## **Phase 4: Gap Analysis**

### **4.1 Collect All Gaps**

**Sources of gaps:**
- Failing tests
- Skipped tests
- Unimplemented plan tasks
- Code TODOs and FIXMEs
- Known issues in GAP-REPORT.md

### **4.2 Categorize Gaps**

| Category | Description |
|----------|-------------|
| **CRITICAL** | Blocks core functionality |
| **HIGH** | Significant feature gaps |
| **MEDIUM** | Quality/completeness issues |
| **LOW** | Nice-to-have improvements |

### **4.3 Create Comprehensive Gap List**

For each gap:
- Description
- Category
- Affected tests/features
- Estimated effort
- Dependencies
- Suggested priority

---

## **Phase 5: Documentation Updates**

### **5.1 Update PROJECT_STATUS.md**

**Must include accurate:**
- Component status (actual, not aspirational)
- Test statistics (from actual test run)
- Recently completed work
- Current gaps and issues
- Realistic roadmap

### **5.2 Update GAP-REPORT.md**

**Regenerate with:**
- Current test results
- All known gaps categorized
- Priority recommendations
- Fix suggestions

### **5.3 Update COMPILER-MASTER-PLAN.md**

**If significant changes:**
- Update completion percentages
- Update milestone status
- Adjust timelines if needed

### **5.4 Archive Completed Plans**

Move completed plan folders to `plans/archive/`:

```bash
mv plans/[completed-plan]/ plans/archive/[completed-plan]/
```

---

## **Phase 6: Create "What's Left" Report**

### **6.1 Comprehensive Report Structure**

Create or update a report with:

```markdown
# What's Left - Blend65 Compiler

> **Generated**: [Date]
> **Test Status**: X/Y passing (Z%)

## Summary

[High-level summary of remaining work]

## By Priority

### Critical (Must Fix)
- [ ] Item 1
- [ ] Item 2

### High Priority (Important)
- [ ] Item 1
- [ ] Item 2

### Medium Priority (Should Do)
- [ ] Item 1
- [ ] Item 2

### Low Priority (Nice to Have)
- [ ] Item 1
- [ ] Item 2

## By Category

### Planned Features (In Plans)
- [ ] Feature 1 (plan: xyz)
- [ ] Feature 2 (plan: xyz)

### Unplanned Gaps (Discovered)
- [ ] Gap 1
- [ ] Gap 2

### Bug Fixes Needed
- [ ] Bug 1
- [ ] Bug 2

### Test Issues
- [ ] Test issue 1
- [ ] Test issue 2

### Documentation Needed
- [ ] Doc 1
- [ ] Doc 2

## Recommended Next Steps

1. [First priority action]
2. [Second priority action]
3. [Third priority action]

## Estimated Remaining Work

| Category | Items | Est. Time |
|----------|-------|-----------|
| Critical | X | X hours |
| High | X | X hours |
| Medium | X | X hours |
| Low | X | X hours |
| **Total** | **X** | **X hours** |
```

---

## **Phase 7: Deliverables Checklist**

Before completing the review, verify ALL deliverables:

### **Required Outputs:**

- [ ] Full test run results captured
- [ ] Test breakdown by component created
- [ ] All plans audited with status
- [ ] Plans to archive identified
- [ ] Plans needing revision identified
- [ ] All gaps collected and categorized
- [ ] `PROJECT_STATUS.md` updated with accurate data
- [ ] `GAP-REPORT.md` updated with current state
- [ ] "What's Left" report created
- [ ] Recommended next steps provided

### **Quality Checks:**

- [ ] All statistics based on actual test runs (not assumptions)
- [ ] All plan statuses verified against code
- [ ] All gaps have clear descriptions
- [ ] All priorities are justified
- [ ] Documentation is internally consistent

---

## **Execution Protocol**

### **Session Management**

This review may span multiple sessions due to thoroughness requirements.

**Session 1**: Test analysis + Plan inventory
**Session 2**: Plan status verification + Gap collection
**Session 3**: Documentation updates + Final report

### **Multi-Session Tracking**

At end of each session:
1. Document what was completed
2. List what remains
3. Provide continuation instructions

At start of continuation:
1. Read previous session summary
2. Pick up from documented stopping point

---

## **Integration with Other Rules**

This review process:
- ✅ Follows `.clinerules/agents.md` task granularity rules
- ✅ Uses `.clinerules/testing.md` test commands
- ✅ Follows `.clinerules/code.md` quality standards
- ✅ Respects multi-session execution limits

---

## **Trigger Variations**

| Trigger | Behavior |
|---------|----------|
| `review_project` | Full deep review (this document) |

**There is NO quick review option. Every review is comprehensive.**

---

## **Success Criteria**

The review is complete when:

1. ✅ Actual test results captured and analyzed
2. ✅ Every active plan audited with verified status
3. ✅ All gaps identified, categorized, and prioritized
4. ✅ `PROJECT_STATUS.md` reflects actual reality
5. ✅ `GAP-REPORT.md` is current and accurate
6. ✅ Clear "What's Left" report with actionable items
7. ✅ Recommended next steps provided

---

## **Remember**

🔴 **NO assumptions** - Always verify with actual tests/code  
🔴 **NO shortcuts** - Complete every phase  
🔴 **NO outdated data** - Everything must be current  
🔴 **NO vague gaps** - Every item needs clear description  
🔴 **NO missing deliverables** - Complete the full checklist  

**This is a DEEP, COMPREHENSIVE review. Do it RIGHT.**