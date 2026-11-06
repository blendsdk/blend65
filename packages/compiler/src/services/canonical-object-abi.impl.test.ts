import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadProject, analyzeProjectOverlay } from "@blend65/compiler/frontend";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { selectTargetProfile } from "../target/profile.js";
import { resourceSourceSpans } from "./resource-diagnostics.js";
import { machineInstruction } from "../machine/lower-control.js";
import {
  closeCanonicalObjectStorage,
  closeCanonicalReference,
  closeCanonicalStorage,
} from "./size-selection.js";
import { validateSizeObservers } from "./size-observers.js";
import { validateResidualEffects } from "./size-observer-effects.js";
import type { CheckedSourceInput } from "./size-selection.js";
import { describe, expect, it } from "vitest";

/** Build the exact two-file acquisition source from the public fallback oracle. */
async function acquisitionInput(): Promise<{
  readonly checked: CheckedSourceInput;
  readonly root: string;
}> {
  const spec = await readFile(
    new URL(
      "../../../../test/rd05/canonical-fixed-object-abi-fallback.spec.test.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const inputSource = /const INPUT_SOURCE = `([\s\S]*?)`;/u.exec(spec)?.[1];
  const gameSource = /const GAME_SOURCE = `([\s\S]*?)`;/u.exec(spec)?.[1];
  if (inputSource === undefined || gameSource === undefined)
    throw new Error("Expected the public acquisition sources");
  const root = await mkdtemp(join(process.env.CODEOPS_TMPDIR ?? process.cwd(), "c64-abi-"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src/input.blend"), inputSource);
  await writeFile(join(root, "src/game.blend"), gameSource);
  const project = join(root, "blend65.json");
  await writeFile(
    project,
    JSON.stringify({
      schemaVersion: 1,
      name: "abi-probe",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
    }),
  );
  const loaded = await loadProject({ cwd: root });
  if (loaded.kind !== "success") throw new Error(JSON.stringify(loaded.diagnostics));
  const analysis = await analyzeProjectOverlay(loaded.snapshot, []);
  const selected = selectTargetProfile("c64-pal-prg-kernal-6581");
  if (selected.kind !== "complete") throw new Error("Profile was not selected");
  const semantic = buildSemanticProgram(analysis);
  if (semantic.kind !== "complete") throw new Error(JSON.stringify(semantic));
  const closed = closeWholeProgram(
    semantic.program,
    selected.profile.interrupts,
    selected.profile.storage,
  );
  if (closed.kind !== "complete") throw new Error(JSON.stringify(closed.diagnostics));
  const checked: CheckedSourceInput = {
    snapshot: { ...loaded.snapshot, ...analysis.inputs },
    profile: selected.profile,
    program: closed.program,
    bindingNames: new Map(
      analysis.program.bindings.map((binding) => [
        bindingIdentityKey(binding.id),
        binding.qualifiedName ?? binding.name,
      ]),
    ),
    resourceSpans: resourceSourceSpans(analysis.program),
    diagnostics: [],
    sourceText: (span) => {
      const source = analysis.inputs.sources.find((entry) => entry.sourceId === span.sourceId);
      return source === undefined
        ? ""
        : Buffer.from(source.text).subarray(span.start, span.end).toString();
    },
  };
  return { checked, root };
}

describe("canonical object byte-loop control proof", () => {
  it("should reject a candidate-only flag clobber between the loop compare and branch", async () => {
    const { checked, root } = await acquisitionInput();
    try {
      const object = closeCanonicalObjectStorage(checked);
      expect(object?.kind).toBe("complete");
      if (object?.kind !== "complete") return;
      const annotatedStorage = closeCanonicalStorage(checked, undefined, undefined, true);
      expect(annotatedStorage.kind).toBe("complete");
      if (annotatedStorage.kind !== "complete") return;
      const annotatedReference = closeCanonicalReference(annotatedStorage.value);
      expect(annotatedReference.kind).toBe("feasible");
      if (annotatedReference.kind !== "feasible") return;
      const objectReference = closeCanonicalReference(object.value, true);
      expect(objectReference.kind).toBe("feasible");
      if (objectReference.kind !== "feasible") return;
      const baseline = validateSizeObservers({
        checked,
        reference: annotatedReference,
        candidate: { lowered: object.value.lowered, shared: objectReference.shared },
      });
      expect(baseline.kind).toBe("complete");
      for (const mutation of ["carry", "initialization"] as const) {
        const clobber =
          mutation === "carry"
            ? machineInstruction(checked.profile.cpu, "clc", "implied", null)
            : machineInstruction(
                checked.profile.cpu,
                "lda",
                "immediate",
                Object.freeze({ kind: "immediate", value: 1 }),
              );
        const mutatedFunctions = object.value.lowered.program.functions.map((fn) =>
          fn.sourceName === "Input.readInputSnapshot"
            ? {
                ...fn,
                blocks: fn.blocks.map((block) => {
                  if (mutation === "carry" && block.label.endsWith(":for-condition"))
                    return { ...block, instructions: [...block.instructions, clobber] };
                  if (mutation === "initialization" && block.label.endsWith(":b3:if-end"))
                    return {
                      ...block,
                      instructions: [
                        ...block.instructions.slice(0, -1),
                        clobber,
                        block.instructions.at(-1)!,
                      ],
                    };
                  return block;
                }),
              }
            : fn,
        );
        const residual = validateResidualEffects({
          checked,
          reference: annotatedReference,
          candidate: {
            lowered: {
              ...object.value.lowered,
              program: {
                ...object.value.lowered.program,
                functions: mutatedFunctions,
              },
            },
            shared: objectReference.shared,
          },
        });
        expect(
          residual.kind,
          `${mutation}: ${residual.kind === "complete" ? "complete" : residual.reason}`,
        ).toBe("rejected");
        if (residual.kind === "rejected") expect(residual.reason).toMatch(/Byte-loop/);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
