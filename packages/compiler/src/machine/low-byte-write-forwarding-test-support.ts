import { fileURLToPath } from "node:url";
import { analyzeProjectOverlay, loadProject } from "../frontend/index.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import type { SemanticBlock, SemanticFunction, SemanticOperation } from "../semantic/operations.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { selectTargetProfile } from "../target/profile.js";
import { selectAnonymousByteWriteValues } from "./byte-write-forwarding.js";
import type { MachineLoweringInput } from "./machine-types.js";

/** A runtime word makes extraction distinct from compile-time byte selection. */
export const BASE = `module Main;
function main():void {
  let value:word=$12A5;
  while(true){value=value+257;poke($D005,lo(value));}
}`;

/** The actual source owner paired with its closed lowering input. */
export interface ClosedSource {
  /** Program and selected profile whose evidence belongs to the source. */
  input: MachineLoweringInput;
  /** Actual main function object retained by the program. */
  source: SemanticFunction;
}

/** Obtain real closed-program evidence without fabricating observer certificates. */
export async function closeSource(text = BASE): Promise<ClosedSource> {
  const project = fileURLToPath(
    new URL("../../../../examples/boing-ball/blend65.json", import.meta.url),
  );
  const loaded = await loadProject({ project });
  if (loaded.kind !== "success") throw new Error("Fixture project did not load");
  const analysis = await analyzeProjectOverlay(loaded.snapshot, [
    { sourceId: "src/main.blend", text },
  ]);
  if (analysis.kind !== "complete") throw new Error("Fixture overlay was not accepted");
  const semantic = buildSemanticProgram(analysis);
  if (semantic.kind !== "complete") throw new Error("Fixture did not produce semantic operations");
  const selected = selectTargetProfile("c64-pal-prg-kernal-6581");
  if (selected.kind !== "complete") throw new Error("Fixture target was not selected");
  const closed = closeWholeProgram(
    semantic.program,
    selected.profile.interrupts,
    selected.profile.storage,
  );
  if (closed.kind !== "complete") throw new Error("Fixture program did not close");
  const source = closed.program.semantic.functions.find(
    (fn) => bindingIdentityKey(fn.id) === bindingIdentityKey(closed.program.semantic.main),
  );
  if (!source) throw new Error("Fixture main was not retained");
  return { input: { program: closed.program, profile: selected.profile }, source };
}

/** Locate the exact semantic window whose eligibility is under test. */
export function windowOf(fixture: ClosedSource) {
  for (const block of fixture.source.blocks) {
    for (let index = 1; index + 1 < block.operations.length; index++) {
      const load = block.operations[index - 1];
      const lo = block.operations[index];
      const write = block.operations[index + 1];
      if (
        load?.kind === "load" &&
        lo?.kind === "unary" &&
        lo.operator === "lo" &&
        lo.operand === load.result &&
        write?.kind === "memory-write" &&
        write.value === lo.result
      ) {
        return { block, index, load, lo, write };
      }
    }
  }
  throw new Error("Fixture lacks an adjacent ordinary-load/lo/write window");
}

/** Keep the supplied source and the program's actual function object identical. */
export function replaceBlocks(
  fixture: ClosedSource,
  blocks: readonly SemanticBlock[],
): ClosedSource {
  const source = { ...fixture.source, blocks };
  const semantic = fixture.input.program.semantic;
  return {
    source,
    input: {
      ...fixture.input,
      program: {
        ...fixture.input.program,
        semantic: {
          ...semantic,
          functions: semantic.functions.map((fn) => (fn === fixture.source ? source : fn)),
        },
      },
    },
  };
}

/** Change one window while preserving every unaffected block object and operation. */
export function changeWindow(
  fixture: ClosedSource,
  edit: (operations: SemanticOperation[], index: number) => void,
) {
  const window = windowOf(fixture);
  const operations = [...window.block.operations];
  edit(operations, window.index);
  return replaceBlocks(
    fixture,
    fixture.source.blocks.map((block) =>
      block === window.block ? { ...block, operations } : block,
    ),
  );
}

/** Deliberately supply optimistic use metadata; the selector must recount complete uses. */
export function select(fixture: ClosedSource, uses?: ReadonlySet<string>) {
  const { load, lo } = windowOf(fixture);
  return selectAnonymousByteWriteValues(
    fixture.input,
    fixture.source,
    fixture.source.blocks,
    uses ?? new Set([load.result, lo.result]),
  );
}
