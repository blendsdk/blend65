import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../frontend/service.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { ProjectSnapshot } from "../project/types.js";
import { selectTargetProfile } from "../target/profile.js";
import { interruptExecutionContexts } from "./interrupt-contexts.js";
import { buildSemanticProgram } from "./lower.js";
import { closeWholeProgram } from "./whole-program.js";
import type { WholeProgram } from "./whole-program.js";

const PROFILE = "c64-pal-prg-kernal-6581";

/** Close real source operations without using files, ACME or an emulator. */
function closeSource(text: string): WholeProgram {
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "handler-contexts",
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
  const selected = selectTargetProfile(PROFILE);
  if (selected.kind !== "complete") throw new Error("Missing selected profile");
  const analyzed = analyzeProject(snapshot);
  expect(analyzed.kind, JSON.stringify(analyzed.diagnostics)).toBe("complete");
  if (analyzed.kind !== "complete") throw new Error("Frontend rejected the fixture");
  const lowered = buildSemanticProgram(analyzed);
  expect(lowered.kind, JSON.stringify(lowered.diagnostics)).toBe("complete");
  if (lowered.kind !== "complete") throw new Error("Semantic lowering rejected the fixture");
  const closed = closeWholeProgram(lowered.program, selected.profile.interrupts);
  expect(closed.kind, JSON.stringify(closed.diagnostics)).toBe("complete");
  if (closed.kind !== "complete") throw new Error("Ownership proof rejected the fixture");
  return closed.program;
}

/** Find one source handler and its deduplicated, stable entry contexts. */
function handlerContexts(program: WholeProgram, name: string) {
  const handler = program.semantic.functions.find((fn) => fn.name === `Game.${name}`);
  if (handler === undefined) throw new Error(`Missing handler ${name}`);
  const key = bindingIdentityKey(handler.id);
  return { key, contexts: interruptExecutionContexts(program).get(key) ?? [] };
}

describe("finite handler IRQ contexts", () => {
  it("closes a masked A/B installation cycle without growing the root-local depth", () => {
    const program = closeSource(`module Game;
import { setIRQ, restoreIRQ } from c64.system;
interrupt function A(): void { setIRQ(&B); restoreIRQ(); }
interrupt function B(): void { setIRQ(&A); restoreIRQ(); }
function main(): void { setIRQ(&A); asm_cli(); asm_nop(); asm_sei(); restoreIRQ(); }`);
    const a = handlerContexts(program, "A");
    const b = handlerContexts(program, "B");
    expect(a.contexts).toHaveLength(2);
    expect(b.contexts).toHaveLength(1);
    expect(new Set(a.contexts.map(({ entrySlot }) => entrySlot)).size).toBe(2);
    for (const context of [...a.contexts, ...b.contexts]) {
      expect(context.domain).toBe("irq");
      expect(context.localIrqDepth).toBe(0);
      expect(context.entrySlot).toBeDefined();
    }
    expect(a.contexts.every(({ activationRoot }) => activationRoot === a.key)).toBe(true);
    expect(b.contexts.every(({ activationRoot }) => activationRoot === b.key)).toBe(true);
  });

  it("revisits a balanced self-install as one existing local slot", () => {
    const program = closeSource(`module Game;
import { setIRQ, restoreIRQ } from c64.system;
interrupt function A(): void { setIRQ(&A); restoreIRQ(); }
function main(): void { setIRQ(&A); asm_cli(); asm_nop(); asm_sei(); restoreIRQ(); }`);
    const a = handlerContexts(program, "A");
    expect(a.contexts).toHaveLength(2);
    expect(new Set(a.contexts.map(({ entrySlot }) => entrySlot)).size).toBe(2);
    expect(a.contexts.every(({ activationRoot }) => activationRoot === a.key)).toBe(true);
    expect(a.contexts.every(({ localIrqDepth }) => localIrqDepth === 0)).toBe(true);
  });
});
