import type { ResidentAsset } from "../assets/asset-types.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import type {
  MachineDataObject,
  MachineFunction,
  MachineInstruction,
  MachineMemoryEffect,
  MachineLoweringInput,
} from "./machine-types.js";
import { machineInstruction } from "./lower-control.js";
import { createC64StartupStateData } from "../layout/startup.js";
import { typeBytes, bindingLabel, loweringFailure } from "./lower-state.js";
import { vicConsumerAlignment, vicConsumerBytes, type VicFieldTransform } from "./vic-fields.js";

/**
 * Lower a side-effect-free constant module initializer to inline runtime stores.
 * @param global Checked declaration with its exact constant runtime bytes.
 * @param input Selected CPU and the same checked program being lowered.
 * @param accumulator Known incoming A byte, or null when no constant is known.
 * @returns Ordered stores and the last constant left in A.
 * @throws {LoweringFailure} If the constant byte count or initializer entry is inconsistent.
 * @example lowerConstantInitializer(global, input, null)
 */
export function lowerConstantInitializer(
  global: WholeProgram["semantic"]["globals"][number],
  input: MachineLoweringInput,
  accumulator: number | null,
): {
  /** Runtime stores in unchanged source-byte order. */
  readonly instructions: readonly MachineInstruction[];
  /** Last constant A value, reusable by the following initializer. */
  readonly accumulator: number | null;
} {
  const bytes = global.runtimeInitialBytes;
  if (bytes === null || global.entry === null || bytes.length !== typeBytes(global.type)) {
    throw loweringFailure(
      "Constant runtime initializer bytes do not match the global",
      global.source,
    );
  }
  const target = bindingLabel("global", global.id);
  const instructions: MachineInstruction[] = [];
  let currentAccumulator = accumulator;
  for (const [offset, value] of bytes.entries()) {
    if (value !== currentAccumulator) {
      instructions.push(
        machineInstruction(
          input.profile.cpu,
          "lda",
          "immediate",
          Object.freeze({ kind: "immediate", value }),
          [],
          global.source,
        ),
      );
      currentAccumulator = value;
    }
    const memory = Object.freeze([
      Object.freeze({
        kind: "write" as const,
        address: Object.freeze({ kind: "symbolic" as const, label: target, offset }),
        width: 1 as const,
        volatile: false,
        order: 0,
      }),
    ]) satisfies readonly MachineMemoryEffect[];
    instructions.push(
      machineInstruction(
        input.profile.cpu,
        "sta",
        "absolute",
        Object.freeze({ kind: "label", label: target, offset }),
        memory,
        global.source,
      ),
    );
  }
  return Object.freeze({
    instructions: Object.freeze(instructions),
    accumulator: currentAccumulator,
  });
}

/** Return the machine data objects owned by globals and reachable assets. */
export function lowerData(
  program: WholeProgram,
  generatedData: ReadonlyMap<string, MachineDataObject>,
  functions: readonly MachineFunction[],
  startup: MachineFunction,
  bindingNames?: ReadonlyMap<string, string>,
  startupState: MachineDataObject = createC64StartupStateData(),
  dropUnreferencedGlobals = false,
): readonly MachineDataObject[] {
  /** Labels and binding storage the emitted code can actually name. */
  const referenced = new Set<string>();
  for (const fn of [...functions, startup])
    for (const block of fn.blocks)
      for (const instruction of block.instructions) {
        if (instruction.operand?.kind === "label") referenced.add(instruction.operand.label);
        if (instruction.operand?.kind === "storage") referenced.add(instruction.operand.requestId);
      }
  const assetTransforms = new Map<string, Set<VicFieldTransform>>();
  for (const fn of [...functions, startup])
    for (const block of fn.blocks)
      for (const instruction of block.instructions) {
        const operand = instruction.operand;
        if (operand?.kind !== "label" || operand.transform === undefined) continue;
        const transforms = assetTransforms.get(operand.label) ?? new Set<VicFieldTransform>();
        transforms.add(operand.transform);
        assetTransforms.set(operand.label, transforms);
      }
  const globals = program.semantic.globals
    .filter(
      (global) =>
        !(global.storage === "constant" && global.type.kind === "scalar" && !global.placement) &&
        !(
          dropUnreferencedGlobals &&
          global.placement === undefined &&
          !referenced.has(bindingLabel("global", global.id)) &&
          ![...referenced].some(
            (id) =>
              id.endsWith(`:local:${bindingIdentityKey(global.id)}`) ||
              id.endsWith(`:parameter:${bindingIdentityKey(global.id)}`),
          )
        ),
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
    .filter(
      (asset): asset is ResidentAsset => asset.kind === "resident-asset" && reachable.has(asset.id),
    )
    .map((asset) => {
      const transforms = assetTransforms.get(`asset.${asset.id}`) ?? new Set<VicFieldTransform>();
      const vicSpriteBlocks = transforms.has("vic-sprite-block");
      const handlerAlignment = asset.constraints.reduce(
        (maximum, constraint) =>
          constraint.kind === "align" ? Math.max(maximum, constraint.bytes) : maximum,
        1,
      );
      const consumerAlignment = Math.max(
        1,
        ...[...transforms].map((transform) => vicConsumerAlignment(transform)),
      );
      // The charset window is 2 KiB, but a source may use only its first
      // characters; partial charsets are legal. Bitmap and screen consumers
      // fetch the complete object, so their extent is enforced.
      const consumerBytes = Math.max(
        0,
        ...[...transforms]
          .filter((transform) => transform !== "vic-charset-select")
          .map((transform) => vicConsumerBytes(transform)),
      );
      const vicVisible =
        transforms.size > 0 ||
        asset.constraints.some(
          (constraint) => constraint.kind === "visibility" && constraint.consumer === "vic",
        );
      return Object.freeze({
        id: `asset.${asset.id}`,
        kind: "asset" as const,
        assetId: asset.id,
        sourceName: asset.sourcePath,
        vicSpriteBlocks,
        vicVisible,
        ...(consumerBytes === 0 ? {} : { vicConsumerBytes: consumerBytes }),
        alignment: Math.max(handlerAlignment, consumerAlignment),
        bytes: asset.bytes,
        ...(asset.placement === undefined ? {} : { placement: asset.placement }),
      });
    });
  const generated = [...generatedData.values()].sort((left, right) =>
    Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
  );
  return Object.freeze([...globals, ...assets, ...generated, startupState]);
}
