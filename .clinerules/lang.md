# Blend Language Specification Modification Guide

## **IMPORTANT**

These rules are **mandatory** and must be applied **strictly and consistently** when asked to add or modify sections in Blend's language specification.

---

## **Rules for Language Specification Changes**

### **Rule 1: Update Table of Contents**

Always check the `README.md` for the table of contents and update it accordingly when adding or modifying sections.

**Steps:**
1. Open `docs/language-specification/README.md`
2. Locate the table of contents section
3. Add or update the entry for your new/modified section
4. Ensure numbering is sequential and consistent
5. Verify all links work correctly

---

### **Rule 2: Create New Files for New Sections**

Always create a new file when a new section is being asked to be added.

**Steps:**
1. Create the new file in `docs/language-specification/` directory
2. Use the naming convention: `##-section-name.md` (e.g., `14-interrupts.md`)
3. Add a reference to this file in the `README.md` table of contents
4. Ensure the section number follows the existing numbering scheme

---

### **Rule 3: Backward Compatibility**

Do **not** assume migration or backward compatibility unless explicitly asked.

**Default Behavior:**
- ✅ Document new features as additive (non-breaking)
- ❌ Don't suggest removing or changing existing features without explicit request
- ✅ Note any potential breaking changes clearly in the documentation
- ✅ When in doubt, ask the user about compatibility concerns

**If Breaking Changes Are Needed:**
- Clearly mark sections with: `⚠️ **BREAKING CHANGE**`
- Document migration path from old to new syntax
- Provide examples of both old and new approaches

---

### **Rule 4: Code Example Formatting**

Wrap all Blend code examples using JavaScript syntax highlighting.

**Format:**
````markdown
```js
// Blend code example here
let counter: u8 = 0;
```
````

**Why JavaScript syntax:**
- Provides better syntax highlighting than plain text
- Blend syntax is similar enough to JavaScript for good visual results
- Consistent with existing documentation

---

### **Rule 5: EBNF Grammar Formatting**

Wrap all EBNF grammar definitions using the `ebnf` code block.

**Format:**
````markdown
```ebnf
statement = assignment | expression ;
assignment = identifier "=" expression ;
```
````

**Requirements:**
- Use proper EBNF notation
- Include terminal and non-terminal definitions
- Add comments where grammar is complex
- Keep grammar rules aligned and readable

---

### **Rule 6: Consistency Check**

Perform a consistency check and update the language specification before completing the task.

**Consistency Checklist:**

1. **✅ Terminology**
   - Use consistent terms throughout all documents
   - Check existing docs for how similar concepts are named
   - Update glossary if new terms are introduced

2. **✅ Formatting**
   - Headers follow the same structure
   - Code blocks use correct syntax highlighting
   - Lists and tables are formatted consistently

3. **✅ Cross-References**
   - Links to other sections work correctly
   - Referenced sections actually exist
   - Forward references are resolved

4. **✅ Examples**
   - All code examples are syntactically valid
   - Examples demonstrate the concept clearly
   - Complex examples have explanatory comments

5. **✅ Completeness**
   - All required sections are present (syntax, semantics, examples)
   - Edge cases are documented
   - Error conditions are explained

---

## **Workflow for Adding/Modifying Sections**

**Step-by-Step Process:**

1. **Read existing documentation** - Understand current structure and terminology
2. **Plan the change** - Outline what needs to be added or modified
3. **Create/modify files** - Make the actual changes following all rules above
4. **Update README.md** - Add/update table of contents entries
5. **Run consistency check** - Verify all 5 points in the checklist
6. **Verify examples** - Ensure all code examples are valid
7. **Cross-check references** - Confirm all links work

---

## **Example: Adding a New Section**

**Scenario:** User asks to add a section on "Interrupt Handling"

**Process:**

1. ✅ Create `docs/language-specification/14-interrupts.md`
2. ✅ Add entry to `README.md`:
   ```markdown
   14. [Interrupt Handling](14-interrupts.md)
   ```
3. ✅ Write content with proper formatting:
   ````markdown
   # Interrupt Handling
   
   ## Overview
   Blend provides native support for 6502 interrupt handling...
   
   ## Syntax
   ```js
   interrupt nmi() {
       // Handle NMI interrupt
   }
   ```
   
   ## Grammar
   ```ebnf
   interrupt_declaration = "interrupt" interrupt_type identifier "(" ")" block ;
   ```
   ````
4. ✅ Run consistency check
5. ✅ Verify no breaking changes (or document them)

---

## **Summary**

When modifying Blend's language specification:
1. 📝 Update table of contents in README.md
2. 📄 Create new files for new sections
3. 🔒 Don't assume backward compatibility
4. 💻 Use `js` syntax highlighting for code examples
5. 📐 Use `ebnf` syntax for grammar definitions
6. ✅ Run consistency check before completing

**Remember:** The language specification is the source of truth for Blend. Changes must be precise, complete, and consistent.
