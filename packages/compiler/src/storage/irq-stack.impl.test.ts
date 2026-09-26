import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../frontend/service.js";
import type { ProjectSnapshot } from "../project/types.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { selectTargetProfile } from "../target/profile.js";
import { simultaneousIRQStackPeak } from "./irq-stack.js";

const PROFILE = "c64-pal-prg-kernal-6581";

/** Give the normal frontend a complete in-memory project, without host tools or files. */
function snapshot(text: string): ProjectSnapshot {
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  return {
    manifest: {
      schemaVersion: 1,
      name: "irq-contexts",
      sourceRoot: "src",
      entry: "Game",
      target: PROFILE,
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: false,
      divisionZeroCheck: false,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: "{}",
      sha256: hash("{}"),
      byteLength: 2,
      resolvedPath: "/probe/blend65.json",
    },
    sources: [
      {
        sourceId: "src/game.blend",
        text,
        sha256: hash(text),
        byteLength: Buffer.byteLength(text),
        resolvedPath: "/probe/src/game.blend",
      },
    ],
    inputSha256: hash(text),
    projectRoot: "/probe",
    sourceRoot: "/probe/src",
    assetPaths: [],
    outDir: "/probe/out",
    overrides: { target: null, entry: null },
    effectiveTarget: PROFILE,
    effectiveEntry: "Game",
  };
}

/** Each execution chooses one arm per level; both arms select the same IRQ behavior. */
function branchingProgram(levels: number): string {
  const parts = [
    "module Game; import { setIRQ, restoreIRQ } from c64.system;",
    "interrupt function handler(): void {}",
    "function leaf(): void { asm_nop(); }",
  ];
  for (let index = 0; index < levels; index += 1) {
    const callee = index === 0 ? "leaf" : `level${index - 1}`;
    const arm = `setIRQ(&handler); ${callee}(); restoreIRQ();`;
    parts.push(
      `function level${index}(): void { if (peek($c000) == 0) { ${arm} } else { ${arm} } }`,
    );
  }
  parts.push(`function main(): void { level${levels - 1}(); }`);
  return parts.join("\n");
}

describe("equivalent interrupt analysis contexts", () => {
  it.each([4, 8, 10])("keeps body analyses linear for %i balanced branch levels", (levels) => {
    const selected = selectTargetProfile(PROFILE);
    if (selected.kind !== "complete") throw new Error("Missing selected profile");
    const analyzed = analyzeProject(snapshot(branchingProgram(levels)));
    expect(analyzed.kind, JSON.stringify(analyzed.diagnostics)).toBe("complete");
    if (analyzed.kind !== "complete") throw new Error("Frontend rejected the valid fixture");
    const semantic = buildSemanticProgram(analyzed);
    if (semantic.kind !== "complete") throw new Error("Semantic lowering failed");
    const closed = closeWholeProgram(semantic.program, selected.profile.interrupts);
    expect(closed.kind, JSON.stringify(closed.diagnostics)).toBe("complete");
    if (closed.kind !== "complete") throw new Error("Ownership proof rejected the fixture");

    let bodyAnalyses = 0;
    const counted = {
      ...closed.program,
      semantic: {
        ...closed.program.semantic,
        functions: closed.program.semantic.functions.map((fn) => ({
          ...fn,
          // Reading a body after the summary lookup identifies actual analysis work.
          // Count work directly: host load and wall-clock watchdogs are not the oracle.
          get blocks() {
            bodyAnalyses += 1;
            return fn.blocks;
          },
        })),
      },
    };
    const peak = simultaneousIRQStackPeak(
      counted,
      [],
      selected.profile.storage.startupStackBytes ?? 0,
      undefined,
    );
    expect(peak.program + peak.system).toBe(2 * (levels + 1) + 7);
    // A small linear allowance covers distinct mask/entry states without prescribing a cache.
    expect(bodyAnalyses).toBeGreaterThan(levels);
    expect(bodyAnalyses).toBeLessThanOrEqual(4 * levels + 4);
  });
});
