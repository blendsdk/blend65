import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import type { MachineDataObject, MachineFunction } from "./machine-types.js";
import { createC64StartupStateData } from "../layout/startup.js";
import { typeBytes, bindingLabel, loweringFailure } from "./lower-state.js";

/** Return the machine data objects owned by globals and reachable assets. */
export function lowerData(
  program: WholeProgram,
  generatedData: ReadonlyMap<string, MachineDataObject>,
  functions: readonly MachineFunction[],
  startup: MachineFunction,
  bindingNames?: ReadonlyMap<string, string>,
  startupState: MachineDataObject = createC64StartupStateData(),
): readonly MachineDataObject[] {
  const spriteAssets = new Set(
    [...functions, startup].flatMap((fn) =>
      fn.blocks.flatMap((block) =>
        block.instructions.flatMap((instruction) =>
          instruction.operand?.kind === "label" &&
          instruction.operand.transform === "vic-sprite-block"
            ? [instruction.operand.label]
            : [],
        ),
      ),
    ),
  );
  const globals = program.semantic.globals
    .filter(
      (global) =>
        !(global.storage === "constant" && global.type.kind === "scalar" && !global.placement),
    )
    .map((global) => {
      const sourceName = bindingNames?.get(bindingIdentityKey(global.id));
      const bytes = typeBytes(global.type);
      const encoded = global.initialBytes;
      if (encoded !== null && encoded.length !== bytes) {
        throw loweringFailure("Global initial bytes do not match the declared type", global.source);
      }
      return Object.freeze({
        id: bindingLabel("global", global.id),
        ...(sourceName === undefined ? {} : { sourceName }),
        kind:
          encoded === null
            ? ("bss" as const)
            : global.storage === "constant"
              ? ("immutable" as const)
              : ("global" as const),
        alignment: 1,
        bytes: encoded ?? Object.freeze(new Array<number>(bytes).fill(0)),
        ...(global.placement ? { placement: global.placement } : {}),
        ...(global.zeropage ? { zeropage: true } : {}),
      });
    });
  const reachable = new Set(program.reachableAssets);
  const assets = program.semantic.assets
    .filter(({ id }) => reachable.has(id))
    .map((asset) => {
      const vicSpriteBlocks = spriteAssets.has(`asset.${asset.id}`);
      return Object.freeze({
        id: `asset.${asset.id}`,
        kind: "asset" as const,
        assetId: asset.id,
        sourceName: asset.sourcePath,
        vicSpriteBlocks,
        alignment: vicSpriteBlocks ? 64 : 1,
        bytes: asset.bytes,
        ...(asset.placement === undefined ? {} : { placement: asset.placement }),
      });
    });
  const generated = [...generatedData.values()].sort((left, right) =>
    Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
  );
  return Object.freeze([...globals, ...assets, ...generated, startupState]);
}
