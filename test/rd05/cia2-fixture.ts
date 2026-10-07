import { access } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "vitest";
import { buildProject, checkProject } from "@blend65/compiler";
import type { ProjectDiagnostic } from "@blend65/compiler";
import { withProfileProject } from "./profile-fixture.js";

/** The cooperative PRG profiles that admit proved private-home-free NMI routes. */
export const CIA2_PROFILES = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;

/** Keep fixture declarations on the existing public platform surface. */
export function cia2Source(main: string, handler = "", helpers = ""): string {
  return `module Game;
import { setNMIExclusive, setNMI, restoreNMI } from c64.system;
import { readTimerACounter, readTimerBCounter, writeTimerALatch, writeTimerBLatch,
configureTimerA, configureTimerB, enableInterruptSources, disableInterruptSources,
readAndClearPendingSources } from c64.cia2;
interrupt function handler(): void { ${handler} }
interrupt function successor(): void {}
${helpers}
function main(): void { ${main} }`;
}

/** Balance an exclusive lease around ordinary mainline device operations. */
export function cia2Lease(body: string, handler = "", helpers = ""): string {
  return cia2Source(`setNMIExclusive(&handler); ${body} restoreNMI();`, handler, helpers);
}

/** Require a trusted nonempty proving location in the actual source input. */
function expectSourceDiagnostic(diagnostic: ProjectDiagnostic, source: string): void {
  expect(diagnostic.primarySpan).not.toBeNull();
  if (diagnostic.primarySpan === null) throw new Error("Missing source proof");
  expect(diagnostic.primarySpan.sourceId).toBe("src/game.blend");
  expect(Number.isInteger(diagnostic.primarySpan.start)).toBe(true);
  expect(Number.isInteger(diagnostic.primarySpan.end)).toBe(true);
  expect(diagnostic.primarySpan.start).toBeGreaterThanOrEqual(0);
  expect(diagnostic.primarySpan.end).toBeGreaterThan(diagnostic.primarySpan.start);
  expect(diagnostic.primarySpan.end).toBeLessThanOrEqual(Buffer.byteLength(source));
  expect(Array.isArray(diagnostic.related)).toBe(true);
  for (const related of diagnostic.related) {
    expect(related.message).toEqual(expect.any(String));
    expect(related.span).toEqual({
      sourceId: expect.any(String),
      start: expect.any(Number),
      end: expect.any(Number),
    });
  }
}

/** Check and assemble through real public services; warnings do not become source bans. */
export async function expectCia2Accepted(source: string, target: string): Promise<void> {
  await withProfileProject(source, target, async (project) => {
    for (const result of [await checkProject({ project }), await buildProject({ project })]) {
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
      expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    }
  });
}

/** Failed source proof must prevent both semantic acceptance and fresh output publication. */
export async function expectCia2Rejected(
  source: string,
  target: string,
  code = "E10278",
  message?: RegExp,
): Promise<void> {
  await withProfileProject(source, target, async (project, root) => {
    for (const result of [await checkProject({ project }), await buildProject({ project })]) {
      expect(result.kind).toBe("failure");
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors.map(({ code: actual }) => actual)).toEqual([code]);
      const diagnostic = errors[0];
      if (diagnostic === undefined) throw new Error("Missing proving diagnostic");
      expectSourceDiagnostic(diagnostic, source);
      if (message !== undefined) expect(diagnostic.message).toMatch(message);
    }
    await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
  });
}
