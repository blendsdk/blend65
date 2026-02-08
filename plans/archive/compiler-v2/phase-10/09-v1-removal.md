# V1 Removal & V2 Rename

> **Document**: 09-v1-removal.md
> **Parent**: [Index](00-index.md)

## Overview

Remove the v1 `packages/compiler/` package and rename `packages/compiler-v2/` to become the primary compiler package. Update all references across the monorepo.

## Steps

### Step 1: Archive v1 package

```bash
# Move v1 to archive (preserve for reference)
mv packages/compiler archive/packages/compiler-v1
```

### Step 2: Rename v2 package

**Option A: Rename directory + update package.json**
```bash
mv packages/compiler-v2 packages/compiler
```
Update `packages/compiler/package.json`:
- `"name": "@blend65/compiler-v2"` → `"name": "@blend65/compiler"`

**Option B: Keep directory as compiler-v2, just update package name**
Less disruptive — the npm package name is what matters for imports.

**Recommended: Option A** — cleaner long-term, directory matches package name.

### Step 3: Update all imports

Files that reference `@blend65/compiler-v2`:
- `packages/cli/package.json` — dependency name
- `packages/cli/src/commands/build.ts` — import
- `packages/cli/src/commands/check.ts` — import
- `packages/cli/src/output/formatter.ts` — import
- Any test files referencing compiler-v2

### Step 4: Update monorepo configuration

- `turbo.json` — if it references compiler-v2 specifically
- `tsconfig.json` — root references
- `compiler-test` script — update paths if needed
- `vitest.config.ts` — update paths if needed

### Step 5: Update library paths

The `LibraryLoader` uses `import.meta.url` to resolve the library directory. After rename:
- Library path resolves from `packages/compiler/src/library/loader.ts`
- Library files at `packages/compiler/library/`
- Verify path resolution still works

### Step 6: Update examples

- `examples/` — any references to compiler package
- `examples/lib/system.blend` — may need updating to v2 version

### Step 7: Clean up

- Remove `packages/compiler-v2/` if renamed
- Remove v1-specific files from archive if not needed
- Update `README.md` references
- Update `PROJECT_STATUS.md`

## Testing Requirements

- Full test suite passes after rename: `./compiler-test`
- CLI commands work: `blend65 build`, `blend65 check`
- Example programs compile successfully
- No broken import paths

## Risk Mitigation

- **Git history**: Rename preserves git history with `git mv`
- **Rollback**: Archive v1 allows quick rollback if needed
- **Incremental**: Do CLI update (08) first with v2 name, then rename
