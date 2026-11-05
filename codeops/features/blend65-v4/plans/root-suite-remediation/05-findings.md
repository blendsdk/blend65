# Root-suite remediation findings

| Finding | Phase | Severity | Area | Ruling |
| --- | --- | --- | --- | --- |
| RV-001 | prior | CRITICAL | joystick-cycle-oracle | fixed |
| SM-001 | current | MAJOR | canonical-fallback | fixed |

## Review and verification evidence

- Independent correctness review of `62e96209..8003d203` found no production
  correctness finding in its bounded lens, but found the joystick scaffold's
  added eight-cycle ceiling charge outside the exact exception.
- The fix restores the original ceiling and moves the common display-dependent
  read into an initializer. One independent fix re-review reports **no findings**
  and clears the exact oracle exception. The 24 affected sample cases pass;
  the other 196 cases were unselected in that directed run.
- The same fix review finds no issue in the empty-frontier authenticated
  canonical fallback, the unoptimized resource-diagnostic handoff, or the new
  implementation-tier service tests. Platform review remains separate.
- `yarn workspace @blend65/compiler vitest run
  src/services/canonical-fallback.impl.test.ts
  src/services/size-observers.impl.test.ts`: **31/31 pass**. Existing copied,
  stale, mutated and startup-visibility rejection guards remain unchanged.
- `yarn vitest run test/rd04/diagnostics-alternate-placement.spec.test.ts
  test/rd04/diagnostics-resource-boundaries.spec.test.ts
  test/rd04/provenance.spec.test.ts test/rd04/resource-accounting.spec.test.ts
  test/rd04/resource-exhaustion.spec.test.ts
  test/rd05/nmi-route-placement.spec.test.ts`: **61/61 pass**, six files.
- `yarn vitest run test/rd08/input-size-runtime.spec.test.ts
  test/rd08/input-object-facts.spec.test.ts`: **128/128 pass**, sequential
  four-profile VICE, including wrap/bus-order, dummy-read opcode guards, unknown
  raw alias, captured values and live returned-pair/IRQ behavior. Runtime was
  run against the fallback build before the separate diagnostic-only edit;
  that edit changes only failed unoptimized layout outcomes, not these
  successful machine artifacts.
- Independent platform review reports **no findings** in the bounded canonical
  acceptance seam. Exact object identity is accepted only after actual storage,
  stack, startup visibility, placement and producer/source checks. No raw/MMIO
  envelope is widened and no transformed winner is displaced. It makes no
  universal-silicon or external-NMI-bound claim.
- `yarn vitest run test/rd08/optimizer-exact-output.impl.test.ts`: **3/3 pass**.
  Saved709, acquisition943, balanced/speed size-quality selection and the
  2163-byte `none` output retain their pinned complete artifact hashes.
- `yarn workspace @blend65/compiler test`: **3,472 pass / two existing skips /
  zero failures**, 193 files. Install, build and typecheck pass.
- Seven remaining directed root files: **422 pass / 44 fail**. Startup selection
  passes104/104, corrected joystick passes220/220, and collision VICE passes16/16.
  Remaining failures are byte selection20, loop/storage8, profile pipeline8 and
  returned-local output8. This is a directed inventory, not a fresh full-root count.
- Independent new stack-pressure specifications have meaningful RED:236 source
  saves fail at237 total; tight-RAM compact and low-stack compact controls pass.
  Two initial fresh-fixture attempts did not establish compact feasibility and
  were corrected by the independent author before implementation: arbitrary raw
  output became typed output, then the immutable-data dependency became a live
  uninitialized RAM buffer with an explicitly contained masked index. All three
  test assertions remained unchanged; existing oracles were untouched. The
  corrected test is now frozen for implementation.

Reviewers ran no shell commands. The primary execution owner supplied command
results. Their agreement is not runtime or physical-hardware proof.
