# CLI & Diagnostic Tool: Composite Optimization Levels

> **Document**: 06-cli-diag.md
> **Parent**: [Index](00-index.md)

## CLI Changes

### File: `packages/cli/src/commands/build.ts`

#### Choices Update

**Current:**
```typescript
choices: ['0', '1', '2', '3', 's', 'z'] as const,
```

**New:**
```typescript
choices: ['0', '1', '1s', '1z', '2', 's', 'z', '3', '3s', '3z'] as const,
```

#### `resolveOptimizationLevel()` Update

Use the new `normalizeOptimizationLevel()` from config types:

```typescript
import { normalizeOptimizationLevel } from '@blend65/compiler';

function resolveOptimizationLevel(opt: unknown): OptimizationLevelId {
  const raw = Array.isArray(opt) ? opt[opt.length - 1] : opt;
  const level = typeof raw === 'string' ? raw : '0';
  return normalizeOptimizationLevel(`O${level}`);
}
```

#### Help Text (epilog) Update

```typescript
.epilog(
  [
    'Optimization Levels:',
    '',
    '  Base Levels (aggressiveness):',
    '    0     No optimization (default)',
    '    1     Basic (DCE, constant folding, inlining)',
    '    2     Standard (all analysis passes)',
    '    3     Aggressive (ZP promotion, strength reduction, multi-pass)',
    '',
    '  Size Modifiers (append s or z to base level):',
    '    +s    Optimize for size (disables inlining/unrolling, adds SizeOpt)',
    '    +z    Minimum size (like s + multiple iterations)',
    '',
    '  Examples:',
    '    -O1      Basic speed optimization',
    '    -O1s     Basic size optimization',
    '    -O3z     Aggressive minimum-size optimization',
    '    -Os      Standard size (same as -O2s)',
    '',
    '  All levels: 0, 1, 1s, 1z, 2, s(=2s), z(=2z), 3, 3s, 3z',
  ].join('\n'),
)
```

#### Examples Update

```typescript
.example('$0 build -O2', 'Standard optimization')
.example('$0 build -Os', 'Optimize for size')
.example('$0 build -O3z', 'Aggressive minimum size')
```

## Diagnostic Tool Changes

### File: `scripts/diag_app.sh`

#### LEVELS Array Update

**Current:**
```bash
LEVELS=("O0" "O1" "O2" "O3" "Os" "Oz")
```

**New:**
```bash
LEVELS=("O0" "O1" "O1s" "O1z" "O2" "Os" "Oz" "O3" "O3s" "O3z")
```

#### OPT_FLAG Extraction

The current extraction `OPT_FLAG="${level:1}"` works for all levels:
- `O0` → `0`, `O1` → `1`, `O1s` → `1s`, `O3z` → `3z`, `Os` → `s`, `Oz` → `z` ✅

No changes needed to the flag extraction logic.

#### Diff Generation

The diff section already compares O0 vs all other levels, so it will automatically
generate diffs for all 10 levels. No code changes needed.

#### Summary Table

The summary table automatically adapts to however many levels are in the array.
The column widths may need slight adjustment since there are now 10 rows instead of 6.

## CLI Test Changes

### File: `packages/cli/src/__tests__/cli.test.ts`

Add tests for:
- New level values accepted (`1s`, `1z`, `3s`, `3z`)
- Alias normalization (`2s` → `Os`, `2z` → `Oz`)  
- Invalid combination error (`0s`, `0z`)
- Help text contains all levels
