import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { EmbeddedValue } from "../assets/asset-types.js";
import type { SemanticBinding, TypedDeclaration } from "../frontend/semantic-types.js";
import type { AnalysisResult } from "../frontend/service.js";
import { ControlFlowBuilder } from "./cfg.js";
import { ExpressionLowerer } from "./lower-expressions.js";
import { initializerBytes } from "./lower-data.js";
import { sinkTerminalChoice } from "./lower-control.js";
import type {
  AggregateDestination,
  SemanticFunction,
  SemanticGlobal,
  SemanticProgram,
  StorageValue,
} from "./operations.js";

/** Complete semantic construction or an unchanged frontend failure state. */
export type SemanticBuildResult =
  | { readonly kind: "complete"; readonly program: SemanticProgram }
  | Extract<AnalysisResult, { readonly kind: "error" | "incomplete" }>;

/** Create the source-order parameter list for one function declaration. */
function functionParameters(
  declaration: TypedDeclaration,
  bindings: readonly SemanticBinding[],
): readonly StorageValue[] {
  return Object.freeze(
    bindings
      .filter(
        (binding) =>
          binding.storage === "parameter" &&
          binding.id.sourceId === declaration.binding.sourceId &&
          binding.declaration.start >= declaration.binding.span.start &&
          binding.declaration.end <= declaration.binding.span.end &&
          binding.type !== null,
      )
      .sort((left, right) => left.declaration.start - right.declaration.start)
      .map((binding) => {
        if (binding.type === null) throw new Error("Completed parameter has no type");
        return Object.freeze({
          id: binding.id,
          type: binding.type,
          ...(binding.outerUnsized ? { outerUnsized: true as const } : {}),
        });
      }),
  );
}

/** Lower one completed function declaration. */
function lowerFunction(
  declaration: TypedDeclaration,
  bindings: readonly SemanticBinding[],
  bindingsByKey: ReadonlyMap<string, SemanticBinding>,
  embeddedByBinding: ReadonlyMap<string, EmbeddedValue>,
): SemanticFunction {
  if (declaration.body === null) throw new Error("Cannot lower a non-function as a function");
  const builder = new ControlFlowBuilder(
    `function:${bindingIdentityKey(declaration.binding)}`,
    bindingsByKey,
  );
  const expressions = new ExpressionLowerer(builder, bindingsByKey, embeddedByBinding);
  builder.lowerBody(declaration.body, expressions.lower);
  const blocks = Object.freeze(
    builder.finish(declaration.type).map((block) =>
      Object.freeze({
        ...block,
        operations: Object.freeze(
          block.operations.map((operation) => {
            if (
              operation.kind !== "load" &&
              operation.kind !== "store" &&
              operation.kind !== "place-address"
            ) {
              return operation;
            }
            if (operation.place.rootType !== undefined) return operation;
            const placeRoot = bindingsByKey.get(bindingIdentityKey(operation.place.root));
            if (placeRoot?.type === null || placeRoot?.type === undefined) {
              throw new Error("Completed place root has no declared type");
            }
            return Object.freeze({
              ...operation,
              place: Object.freeze({ ...operation.place, rootType: placeRoot.type }),
            });
          }),
        ),
      }),
    ),
  );
  const binding = bindingsByKey.get(bindingIdentityKey(declaration.binding));
  if (binding === undefined) throw new Error("Completed function has no retained binding");
  return Object.freeze({
    id: declaration.binding,
    name: binding.qualifiedName ?? binding.name,
    exported: binding.exported,
    entryKind: binding.functionMode === "interrupt" ? "interrupt" : "ordinary",
    parameters: functionParameters(declaration, bindings),
    result: declaration.type,
    entry: builder.entry,
    blocks,
    statusStackPeak: declaration.statusStackPeak ?? 0,
    source: declaration.binding.span,
    ...(declaration.placement ? { placement: declaration.placement } : {}),
  });
}

/** Lower one completed module or constant declaration. */
function lowerGlobal(
  declaration: TypedDeclaration,
  binding: SemanticBinding,
  bindingsByKey: ReadonlyMap<string, SemanticBinding>,
  embeddedByBinding: ReadonlyMap<string, EmbeddedValue>,
): SemanticGlobal {
  if (binding.storage !== "module" && binding.storage !== "constant") {
    throw new Error("Completed global has a non-global storage class");
  }
  if (declaration.initializer === null) {
    return Object.freeze({
      id: declaration.binding,
      storage: binding.storage,
      name: binding.name,
      type: declaration.type,
      initialBytes: null,
      runtimeInitialBytes: null,
      entry: null,
      blocks: Object.freeze([]),
      source: declaration.binding.span,
      ...(declaration.placement ? { placement: declaration.placement } : {}),
      ...(declaration.zeropage ? { zeropage: true } : {}),
    });
  }
  if (binding.storage === "constant") {
    return Object.freeze({
      id: declaration.binding,
      storage: binding.storage,
      name: binding.name,
      type: declaration.type,
      initialBytes:
        (declaration.type.kind === "scalar" || declaration.type.kind === "enum") &&
        !declaration.placement
          ? null
          : initializerBytes(declaration.initializer, declaration.type),
      runtimeInitialBytes: null,
      entry: null,
      blocks: Object.freeze([]),
      source: declaration.binding.span,
      ...(declaration.placement ? { placement: declaration.placement } : {}),
      ...(declaration.zeropage ? { zeropage: true } : {}),
    });
  }
  const builder = new ControlFlowBuilder(
    `initializer:${bindingIdentityKey(declaration.binding)}`,
    bindingsByKey,
  );
  const expressions = new ExpressionLowerer(builder, bindingsByKey, embeddedByBinding);
  const destination: AggregateDestination | undefined =
    declaration.type.kind === "array" || declaration.type.kind === "struct"
      ? Object.freeze({
          kind: "place",
          place: Object.freeze({
            root: declaration.binding,
            rootType: declaration.type,
            path: Object.freeze([]),
          }),
        })
      : undefined;
  const value = expressions.lower(declaration.initializer, destination);
  if (value === null) throw new Error("Completed module initializer did not produce a value");
  builder.emit(
    Object.freeze({
      kind: "store",
      place: Object.freeze({
        root: binding.id,
        rootType: declaration.type,
        path: Object.freeze([]),
      }),
      value,
      type: declaration.type,
      span: declaration.initializer.span,
    }),
  );
  const blocks = builder.finish(Object.freeze({ kind: "scalar", name: "void" }));
  return Object.freeze({
    id: declaration.binding,
    storage: binding.storage,
    name: binding.name,
    type: declaration.type,
    initialBytes: null,
    runtimeInitialBytes: initializerBytes(declaration.initializer, declaration.type),
    entry: builder.entry,
    blocks,
    source: declaration.binding.span,
    ...(declaration.placement ? { placement: declaration.placement } : {}),
    ...(declaration.zeropage ? { zeropage: true } : {}),
  });
}

/** Build the target-neutral semantic program only from a complete frontend result. */
export function buildSemanticProgram(analysis: AnalysisResult): SemanticBuildResult {
  if (analysis.kind !== "complete") return analysis;
  const frontend = analysis.program;
  const bindingsByKey = new Map(
    frontend.bindings.map((binding) => [bindingIdentityKey(binding.id), binding] as const),
  );
  const embeddedByBinding = new Map(
    frontend.declarations.flatMap((declaration) =>
      declaration.initializer?.embedded === undefined
        ? []
        : [[bindingIdentityKey(declaration.binding), declaration.initializer.embedded] as const],
    ),
  );
  const embeddedBindings = new Set(embeddedByBinding.keys());
  const mainCandidates = frontend.bindings.filter(
    (binding) => binding.storage === "function" && binding.name === "main",
  );
  if (mainCandidates.length !== 1) {
    throw new Error("Completed frontend program must contain exactly one selected main function");
  }

  const functions: SemanticFunction[] = [];
  const globals: SemanticGlobal[] = [];
  for (const declaration of frontend.declarations) {
    const binding = bindingsByKey.get(bindingIdentityKey(declaration.binding));
    if (binding === undefined) throw new Error("Completed declaration has no retained binding");
    if (declaration.body !== null) {
      functions.push(
        lowerFunction(declaration, frontend.bindings, bindingsByKey, embeddedByBinding),
      );
    } else if (
      (binding.storage === "module" || binding.storage === "constant") &&
      !declaration.loadable &&
      !embeddedBindings.has(bindingIdentityKey(declaration.binding))
    ) {
      globals.push(lowerGlobal(declaration, binding, bindingsByKey, embeddedByBinding));
    }
  }
  return Object.freeze({
    kind: "complete",
    program: Object.freeze({
      main: mainCandidates[0]!.id,
      globals: Object.freeze(globals),
      functions: Object.freeze(
        functions.map((fn) => sinkTerminalChoice(fn, functions, bindingsByKey)),
      ),
      effects: frontend.effects,
      assets: frontend.assets,
      residentAssetRoots: Object.freeze([
        ...new Set(
          frontend.declarations.flatMap((declaration) =>
            !declaration.loadable && declaration.initializer?.embedded !== undefined
              ? [declaration.initializer.embedded.assetId]
              : [],
          ),
        ),
      ]),
      initializerOrder: Object.freeze(
        frontend.initializerOrder.filter(
          (binding) => !embeddedBindings.has(bindingIdentityKey(binding)),
        ),
      ),
    }),
  });
}
