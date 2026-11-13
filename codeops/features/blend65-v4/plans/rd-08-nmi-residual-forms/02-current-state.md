# Current State — RD-08 Residual NMI Forms

> **Baseline tree**: `bbce4c1b`
> **Updated**: 2026-11-13

## Reproduced baseline

All five ledger probes fail with `E10245` and no generation. The diagnostic is the canonical
private-storage message, not a different source error.

| Probe | Baseline reason |
|---|---|
| `(w & 258) != 0` | `lowerBitwise` requests a two-byte temporary for the word result |
| `let m = maskValue \| 1; (read() & m) != 0` | `m` has no elision: the `\|` initializer and right-hand `&` consumer are outside the retention proof |
| `(read() & 8) == 8` | The masked-value selection only accepts a zero comparison; the masked byte is retained |
| nine `peek` samples | `MAX_STACK_RETAINED_BYTES = 8` rejects the ninth byte |
| sample across a join | `nmiStackRetainedLocals` requires exactly one block and no calls |

## Existing machinery

- `selectRegisterForwarding` selects byte and zero-extended word masks for the zero-test branch.
- `lowerBooleanBranch` splits the current machine block with `beq` and 0/1 arms.
- `lowerBitwise` computes a byte result in A; a word result with a wide mask requests a temporary.
- `appendLoadA` emits `TSX; LDA $0100+n,X` for a `{kind:"stack"}` value and reuses X while valid.
- `nmiStackRetainedLocals` proves one straight-line block, one to eight loads, no calls, and at
  most eight bytes.
- The storage inventory omits retained locals before allocation and carries the binding keys to the
  machine layer.
- The NMI wrapper adds the body `stackBytes` to the entry demand; `TSX` makes the wrapper save X.

## Verification baseline

- `test/rd08/nmi-boolean-mask-materialization.spec.test.ts`: 101/101 pass.
- The focused NMI/CIA2 route suites were last recorded at 32 files / 778 tests.
- The full compiler suite was last recorded at 224 files / 3,782 passed / 2 skipped.
- `spec/` is clean; the working tree is clean at the baseline commit.
