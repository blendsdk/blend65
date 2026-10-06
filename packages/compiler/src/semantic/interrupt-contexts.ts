import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticOperation } from "./operations.js";
import type { WholeProgram } from "./whole-program.js";
import { walkInterruptExecutionContexts } from "./interrupt-context-walk.js";
export { analyzeInterruptContexts } from "./interrupt-context-proof.js";
export type { InterruptContextAnalysis } from "./interrupt-context-proof.js";

/** The vector depth at one statically selected function entry. */
export interface InterruptExecutionContext {
  /** Independently entering mainline or interrupt execution. */
  readonly domain: "main" | "irq" | "nmi";
  /** Code/storage namespace; the execution proof uses an actual selected handler identity. */
  readonly activationRoot?: string;
  /** IRQ ownership depth inside the handler, excluding its incoming vector. */
  readonly localIrqDepth?: number;
  /** NMI ownership depth inside the handler, excluding its incoming vector. */
  readonly localNmiDepth?: number;
  /** Saved predecessor slot permanently bound to this selected entry wrapper. */
  readonly entrySlot?: string;
  /** Live IRQ predecessor words on entry. */
  readonly irq: number;
  /** Live NMI predecessor words on entry. */
  readonly nmi: number;
}

/** Source-function identities mapped to their finite entry contexts. */
export type InterruptExecutionContexts = ReadonlyMap<string, readonly InterruptExecutionContext[]>;

/** Name one sink's exact predecessor word in the installing execution context. */
export function interruptPredecessorSlot(
  context: InterruptExecutionContext,
  sink: "irq" | "nmi",
): string {
  const local = sink === "irq" ? context.localIrqDepth : context.localNmiDepth;
  return context.activationRoot === undefined
    ? `interrupt-link:${sink}:${context[sink]}`
    : `interrupt-link:${sink}:${context.activationRoot}:${local ?? 0}`;
}

/** Preserve the existing IRQ slot identity for IRQ-only consumers. */
export function irqPredecessorSlot(context: InterruptExecutionContext): string {
  return interruptPredecessorSlot(context, "irq");
}

/** Add the locally proved ownership depth to one caller's concrete entry depth. */
export function interruptDepthAt(
  context: InterruptExecutionContext,
  operation: SemanticOperation,
  program: WholeProgram,
): InterruptExecutionContext {
  const relative = program.interruptOwnership?.relativeDepths.get(operation);
  return Object.freeze({
    domain: context.domain,
    ...(context.activationRoot === undefined ? {} : { activationRoot: context.activationRoot }),
    ...(context.activationRoot === undefined
      ? {}
      : { localIrqDepth: (context.localIrqDepth ?? 0) + (relative?.irq ?? 0) }),
    ...(context.localNmiDepth === undefined
      ? {}
      : { localNmiDepth: context.localNmiDepth + (relative?.nmi ?? 0) }),
    ...(context.entrySlot === undefined ? {} : { entrySlot: context.entrySlot }),
    irq: context.irq + (relative?.irq ?? 0),
    nmi: context.nmi + (relative?.nmi ?? 0),
  });
}

/** Return the one shared context result, or discover its structural predecessor bindings. */
export function interruptExecutionContexts(program: WholeProgram): InterruptExecutionContexts {
  return program.interruptContextAnalysis?.contexts ?? walkInterruptExecutionContexts(program);
}

/** Exact predecessor depth reached at each installed handler source site. */
export function interruptRouteDepths(
  program: WholeProgram,
  contexts: InterruptExecutionContexts,
): ReadonlyMap<SemanticOperation, readonly number[]> {
  const depths = new Map<SemanticOperation, readonly number[]>();
  for (const route of program.interruptRoutes ?? []) {
    const owner = program.semantic.functions.find((fn) =>
      fn.blocks.some((block) => block.operations.includes(route.installation)),
    );
    const entries =
      owner === undefined
        ? program.semantic.globals.flatMap((global) =>
            global.blocks.some((block) => block.operations.includes(route.installation))
              ? [
                  Object.freeze({
                    domain: "main" as const,
                    irq:
                      program.interruptOwnership?.initializerEntryDepths.get(
                        bindingIdentityKey(global.id),
                      )?.irq ?? 0,
                    nmi:
                      program.interruptOwnership?.initializerEntryDepths.get(
                        bindingIdentityKey(global.id),
                      )?.nmi ?? 0,
                  }),
                ]
              : [],
          )
        : (contexts.get(bindingIdentityKey(owner.id)) ?? []);
    depths.set(
      route.installation,
      Object.freeze(
        [
          ...new Set(
            entries.map(
              (entry) => interruptDepthAt(entry, route.installation, program)[route.sink.domain],
            ),
          ),
        ].sort((left, right) => left - right),
      ),
    );
  }
  return depths;
}
