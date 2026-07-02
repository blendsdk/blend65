/**
 * The RD-17 T4 test fixture plugin (AR-P2) — TEST SUPPORT ONLY.
 *
 * A copy of the c64 plugin contributing one T4 intrinsic (`fix_probe(): void`,
 * `'call'` lowering) plus its runtime module, so the *mechanism* (registry
 * merge, import boundary, `baseUrl` embedding) is proven end-to-end without
 * inventing production platform intrinsics (the language guard owns those).
 *
 * NEVER exported from the package barrel (`src/index.ts`) — consumed only by
 * this package's own tests. Other packages build their own test-local fixtures
 * (AR-P2 allows a test-local factory) to respect package boundaries.
 */

import type { IntrinsicDescriptor, PlatformPlugin } from "@blend65/core/platform";
import { c64Plugin } from "../c64.js";

/** The fixture T4 descriptor: `fix_probe(): void`, runtime-call lowering. */
export const FIX_PROBE: IntrinsicDescriptor = {
  name: "fix_probe",
  tier: "T4",
  signature: { params: [], returnType: "void" },
  availability: () => true, // platform gating is added by the registry merge wrapper
  loweringStrategy: "call",
  costMetadata: { cycles: "varies", bytes: "varies", zpBytes: 0 },
  clobberList: ["A", "status"],
  description: "test fixture: probes the T4 contribution mechanism (AR-P2).",
};

/**
 * The fixture plugin: the real c64 plugin with the T4 contribution attached.
 * `baseUrl` self-locates the module so embedding resolves it from `src/`
 * (vitest) and `dist/` (built) identically (PF-017).
 */
export const fixturePlugin: PlatformPlugin = {
  ...c64Plugin,
  intrinsics: [FIX_PROBE],
  runtimeModules: [
    {
      name: "fix-probe",
      asmPath: "../../__fixtures__/fix-probe.asm",
      exports: ["fix_probe"],
      baseUrl: import.meta.url,
    },
  ],
};
