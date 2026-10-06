import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { InterruptProfileFacts } from "../target/profile.js";
import type { HandlerTargetSets } from "./function-targets.js";
import type { SemanticProgram } from "./operations.js";
import type { InterruptRoute } from "./whole-program.js";
import { reachableBlocks } from "./value-lifetimes.js";

/** Select only handlers installed by reachable source paths. */
export function reachableInterruptRoutes(
  semantic: SemanticProgram,
  reached: ReadonlySet<string>,
  targets: HandlerTargetSets,
  profile: InterruptProfileFacts | undefined,
): {
  readonly routes: readonly InterruptRoute[];
  readonly diagnostics: readonly ProjectDiagnostic[];
} {
  if (profile === undefined) return { routes: [], diagnostics: [] };
  const sinks = new Map(profile.sinks.map((sink) => [sink.capability, sink] as const));
  const variants = new Map(profile.variants.map((variant) => [variant.id, variant] as const));
  const functions = new Map(
    semantic.functions.map((fn) => [bindingIdentityKey(fn.id), fn] as const),
  );
  const globals = new Map(
    semantic.globals.map((global) => [bindingIdentityKey(global.id), global] as const),
  );
  const owners = [
    ...semantic.functions.filter((fn) => reached.has(bindingIdentityKey(fn.id))),
    ...semantic.initializerOrder.flatMap((id) => {
      const global = globals.get(bindingIdentityKey(id));
      return global === undefined ? [] : [global];
    }),
  ];
  const routes = new Map<string, InterruptRoute>();
  const diagnostics: ProjectDiagnostic[] = [];
  for (const owner of owners) {
    if (owner.entry === null) continue;
    for (const block of reachableBlocks(owner.entry, owner.blocks)) {
      for (const operation of block.operations) {
        if (operation.kind !== "platform") continue;
        const sink = sinks.get(operation.capability);
        if (sink === undefined) continue;
        const stockChainedNmi =
          sink.capability === "c64.system.setNMI" &&
          sink.variant === "c64_kernal_nminv_chain" &&
          sink.domain === "nmi";
        if (
          !sink.masksSelfOnEntry &&
          sink.externalReentryBound === "unbounded" &&
          !stockChainedNmi
        ) {
          diagnostics.push(
            projectDiagnostic(
              "E10245",
              `Execution path '${sink.source}' has unbounded private-storage overlap, disallowed unbounded stack use, or unproved generated reentrancy`,
              operation.span,
            ),
          );
          continue;
        }
        const handlers = targets.get(operation) ?? [];
        if (handlers.length === 0) {
          diagnostics.push(
            projectDiagnostic(
              "E10247",
              `Cannot prove the entry ABI of the value passed to function-address sink '${sink.capability}' — pass a provenance-preserving handler address`,
              operation.span,
            ),
          );
          continue;
        }
        for (const handler of handlers) {
          const fn = functions.get(bindingIdentityKey(handler));
          if (fn?.entryKind !== "interrupt") {
            diagnostics.push(
              projectDiagnostic(
                "E10244",
                `Ordinary function cannot be installed in interrupt-handler sink '${sink.capability}' — use an interrupt function`,
                operation.span,
              ),
            );
            continue;
          }
          routes.set(
            `${bindingIdentityKey(handler)}\0${sink.variant}\0${operation.span.sourceId}:${operation.span.start}`,
            Object.freeze({
              handler,
              sink,
              variant: variants.get(sink.variant)!,
              installation: operation,
            }),
          );
        }
      }
    }
  }
  return Object.freeze({
    routes: Object.freeze([...routes.values()]),
    diagnostics: Object.freeze(diagnostics),
  });
}
