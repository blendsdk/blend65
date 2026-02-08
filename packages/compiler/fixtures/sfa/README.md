# SFA Test Fixtures

Test fixtures for Static Frame Allocation (SFA) implementation.

## Directory Structure

```
sfa/
├── 01-basic/           # Simple allocation scenarios
│   ├── single-function.blend
│   ├── two-functions.blend
│   ├── nested-calls.blend
│   ├── with-parameters.blend
│   └── with-arrays.blend
├── 02-coalescing/      # Frame coalescing tests
│   ├── non-overlapping.blend
│   ├── overlapping.blend
│   └── deep-calls.blend
├── 03-zp/              # Zero page allocation tests (future)
├── 04-threads/         # Thread safety tests (future)
└── 05-stress/          # Memory limit tests (future)
```

## Fixture Categories

### 01-basic/

Simple allocation scenarios for basic SFA functionality:

| Fixture | Purpose | Expected Result |
|---------|---------|-----------------|
| `single-function.blend` | Single function with locals | Frame at $0200, 2 bytes |
| `two-functions.blend` | Two sibling functions | Functions can coalesce |
| `nested-calls.blend` | Deep call chain (main→outer→middle→inner) | Separate frames, no coalescing |
| `with-parameters.blend` | Functions with parameters | Parameters as slots |
| `with-arrays.blend` | Functions with array locals | Arrays in frame region |

### 02-coalescing/

Tests for frame coalescing (memory sharing):

| Fixture | Purpose | Expected Result |
|---------|---------|-----------------|
| `non-overlapping.blend` | Functions never active together | Share same base address |
| `overlapping.blend` | Nested calls (parent-child) | Separate frames |
| `deep-calls.blend` | Complex call graph | Multiple coalesce groups |

## Usage

These fixtures are used by SFA tests. Load them using:

```typescript
import { loadFixture } from '../helpers';

const source = loadFixture('sfa/01-basic/single-function.blend');
```

## See Also

- [07-fixtures.md](../../../plans/sfa-implementation/05-testing/07-fixtures.md) - Full fixture specification
- [08-e2e-scenarios.md](../../../plans/sfa-implementation/05-testing/08-e2e-scenarios.md) - E2E test scenarios