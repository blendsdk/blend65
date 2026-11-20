import { buildProject } from "@blend65/compiler";
import type { OptimizationGoal } from "@blend65/compiler";
import { expect } from "vitest";
import { readProfileArtifacts, withProfileProject } from "../rd05/profile-fixture.js";

/**
 * Shared detection of how a call through a function pointer was dispatched.
 *
 * Several suites judge which of the two dispatch shapes a program received. Keeping the patterns
 * and the build helper in one place means the definition of "the cheap dispatch" cannot drift
 * between them.
 */

/** A dispatch block, found by the indirect transfer that forms its whole body. */
export const indirectTransfer = /^\s*jmp\s+\(\$[0-9a-f]{4}\)\s*$/imu;

/**
 * Comparing the pointer against a candidate address is the alternative, costlier dispatch.
 *
 * Deliberately not global: a global regular expression advances its own `lastIndex`, so a shared
 * instance used by more than one assertion would match inconsistently depending on call order.
 */
export const candidateComparison = /^\s*cmp\s+#[<>]\(/imu;

/** Every occurrence of a candidate comparison, for counting rather than detecting. */
export function candidateComparisons(assembly: string): readonly string[] {
  return assembly.match(/^\s*cmp\s+#[<>]\(/gimu) ?? [];
}

/**
 * Build one program and return its published assembly, failing with the refusal if there is one.
 *
 * @param source Complete legal module text.
 * @param target Platform profile to build for.
 * @param optimization Optimization goal; the default matches the release baseline.
 * @returns The emitted assembly text of the published artifact.
 * @example const assembly = await assembleFor(source, "c64-pal-prg-kernal-6581");
 */
export async function assembleFor(
  source: string,
  target: string,
  optimization: OptimizationGoal = "none",
): Promise<string> {
  return await withProfileProject(source, target, async (project) => {
    const built = await buildProject({ project, optimization });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") throw new Error("The program reached no publication");
    return (await readProfileArtifacts(built)).assembly;
  });
}
