## CRITICAL: Refactore Code Base

**NO inline imports** - refactore inline imports like `import('../../../semantic/analysis/m6502-hints.js').AccessPatternInfo` to proper import at the top of .ts files - update the code.md to follow this critical rule strictly

**NO constructor.name == `...`** - refactore constructor.name evaluations to proper `instanceof` in typescript - update the code.md to follow this critical rule strictly

**NO hardcoded string comparison** - refactore card coded string comparisons like `if (stmt.getNodeType() === 'VariableDecl') {` to their proper enum or constant types (ASTNodeType) - search and fix any / all patterns alike and do proper refactoring - update the code.md to follow this critical rule strictly

**NO Mock in tests when the read object exist**
    - do not mock objects in tests when the real object exists or have been developed by now
    - refactore fake mock tests to use real objects
