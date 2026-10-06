import type { SemanticOperation } from "../semantic/operations.js";
import type { InterruptRoute } from "../semantic/whole-program.js";
import { interruptDepthAt, interruptPredecessorSlot } from "../semantic/interrupt-contexts.js";
import { interruptEntrySelection } from "../semantic/interrupt-context-facts.js";
import { lowerC64Operation } from "./lower-c64.js";
import { c64InterruptEntryLabel } from "./lower-c64.js";
import { machineInstruction, type LoweredValue } from "./lower-control.js";
import type { MachineInstruction } from "./machine-types.js";
import {
  loweringFailure,
  requestStorage,
  retainMachineValue,
  type FunctionLoweringState,
} from "./lower-state.js";

/**
 * Convert one retained zero-flag condition into the language's canonical boolean byte.
 * Direct branches keep using the flag. A value that is stored or passed must instead become
 * `0` or `1` without adding a helper call or control-flow block.
 */
function materializeCondition(
  result: LoweredValue,
  instructionsInput: readonly MachineInstruction[],
  operation: Extract<SemanticOperation, { readonly kind: "platform" }>,
  state: FunctionLoweringState,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
  if (
    result.kind !== "condition" ||
    operation.result === null ||
    !state.materializedValues.has(operation.result)
  ) {
    return Object.freeze({ instructions: instructionsInput, result });
  }
  if (result.usesFlag !== "z" || (result.whenTrue !== "beq" && result.whenTrue !== "bne")) {
    throw loweringFailure("Platform condition cannot be materialized as a boolean", operation.span);
  }

  const instructions = [
    ...instructionsInput,
    machineInstruction(
      state.input.profile.cpu,
      "cmp",
      "immediate",
      Object.freeze({ kind: "immediate", value: 1 }),
      [],
      operation.span,
    ),
    machineInstruction(
      state.input.profile.cpu,
      "lda",
      "immediate",
      Object.freeze({ kind: "immediate", value: 0 }),
      [],
      operation.span,
    ),
    machineInstruction(
      state.input.profile.cpu,
      "adc",
      "immediate",
      Object.freeze({ kind: "immediate", value: 0 }),
      [],
      operation.span,
    ),
  ];
  if (result.whenTrue === "beq") {
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "eor",
        "immediate",
        Object.freeze({ kind: "immediate", value: 1 }),
        [],
        operation.span,
      ),
    );
  }
  return Object.freeze({
    instructions: Object.freeze(instructions),
    result: Object.freeze({ kind: "register", registers: "a", bytes: 1, signed: false }),
  });
}

/** Select one profile operation while preserving its declared effects and result. */
export function lowerPlatformOperation(
  operation: Extract<SemanticOperation, { readonly kind: "platform" }>,
  state: FunctionLoweringState,
  selectedInterruptRoute?: InterruptRoute,
): readonly MachineInstruction[] {
  try {
    const lowered = lowerC64Operation(operation, state.values, state.input.profile, {
      requestScratch: (suffix, bytes, source, reason) =>
        requestStorage(state, suffix, "temporary", bytes, "ram", source, reason),
      interruptBinding: (sourceOperation) => {
        const sink = state.input.profile.interrupts.sinks.find(
          ({ capability }) => capability === sourceOperation.capability,
        );
        const domain =
          sink?.domain ?? (sourceOperation.capability === "c64.system.restoreIRQ" ? "irq" : "nmi");
        const program = state.input.program;
        const atOperation = interruptDepthAt(state.interruptDepth, sourceOperation, program);
        const before = atOperation[domain];
        const depth = sink === undefined ? before - 1 : before;
        if (depth < 0) throw new Error("Interrupt restore has no active static link");
        const needsProof = program.interruptRoutes?.some(({ sink }) => sink.domain === "nmi");
        const proof = needsProof ? program.interruptContextAnalysis : undefined;
        if (needsProof && (proof === undefined || proof.diagnostics.length > 0))
          throw new Error("Interrupt lowering requires complete installation-link proof");
        const { activationRoot, ...sourceContext } = atOperation;
        const root = domain === "irq" || proof !== undefined ? activationRoot : undefined;
        const localField = domain === "irq" ? "localIrqDepth" : "localNmiDepth";
        const localDepth =
          root === undefined
            ? depth
            : (atOperation[localField] ?? 0) - (sink === undefined ? 1 : 0);
        if (localDepth < 0) throw new Error("Interrupt restore crosses its handler prefix");
        const linkRequestId = interruptPredecessorSlot(
          {
            ...sourceContext,
            ...(root === undefined ? {} : { activationRoot: root }),
            [domain]: depth,
            [localField]: localDepth,
          },
          domain,
        );
        const binding = proof?.bindings.get(linkRequestId);
        const retained =
          proof === undefined
            ? undefined
            : state.input.retainedInterrupts?.links.get(linkRequestId);
        if (proof !== undefined && binding === undefined && retained === undefined)
          throw new Error("Interrupt operation has no proved predecessor word");
        const routes = (state.input.program.interruptRoutes ?? []).filter(
          ({ installation }) => installation === sourceOperation,
        );
        if (sink !== undefined && selectedInterruptRoute === undefined && routes.length !== 1) {
          throw new Error("Interrupt sink needs one statically selected handler entry");
        }
        const route = selectedInterruptRoute ?? routes[0];
        if (sink !== undefined && route === undefined)
          throw new Error("Interrupt installation has no selected entry");
        const selection =
          proof === undefined || route === undefined
            ? undefined
            : interruptEntrySelection(route, linkRequestId, program);
        if (
          selection !== undefined &&
          !binding?.captures.some(({ entryIdentity }) => entryIdentity === selection.id) &&
          !retained?.entries.some(({ id }) => id === selection.id)
        )
          throw new Error("Interrupt entry is absent from its proved capture choices");
        return Object.freeze({
          linkRequestId,
          matchingLowNmi: proof !== undefined && domain === "nmi",
          stockCia1Handback:
            state.input.program.interruptOwnership?.cia1Handbacks.has(sourceOperation) ?? false,
          entryLabel:
            sink === undefined || route === undefined
              ? null
              : c64InterruptEntryLabel(
                  route.handler,
                  route.variant,
                  depth,
                  proof !== undefined
                    ? selection?.tail
                    : root === undefined
                      ? undefined
                      : linkRequestId,
                  proof !== undefined,
                ),
        });
      },
    });
    for (const data of lowered.data) {
      const existing = state.generatedData.get(data.id);
      if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(data)) {
        throw new Error(`Generated data identity '${data.id}' changed contents`);
      }
      state.generatedData.set(data.id, data);
    }
    if (operation.result !== null && lowered.result !== null) {
      const materialized = materializeCondition(
        lowered.result,
        lowered.instructions,
        operation,
        state,
      );
      const retained = retainMachineValue(
        operation.result,
        materialized.result,
        materialized.instructions,
        operation.type,
        operation.span,
        state,
      );
      state.values.set(operation.result, retained.value);
      return retained.instructions;
    }
    return lowered.instructions;
  } catch (error) {
    throw loweringFailure(
      error instanceof Error ? error.message : "Cannot lower platform operation",
      operation.span,
    );
  }
}
