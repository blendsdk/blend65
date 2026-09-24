import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { SemanticFunction, SemanticOperation } from "../semantic/operations.js";
import type { SemanticPosition, ValueLifetime, WholeProgram } from "../semantic/whole-program.js";
import type {
  FunctionResultLocation,
  ResultLocation,
  StorageClass,
  StorageInventory,
  StorageRequest,
} from "./storage-types.js";

/** Return the in-memory byte width of one source type. */
function typeBytes(type: SemanticType, parameter = false): number {
  if (type.kind === "array" || type.kind === "struct") return parameter ? 2 : type.size;
  if (type.name === "void") return 0;
  return type.name === "word" || type.name === "sword" ? 2 : 1;
}

/** Return every represented operation boundary in stable block order. */
function functionPositions(fn: Pick<SemanticFunction, "blocks">): readonly SemanticPosition[] {
  return Object.freeze(
    fn.blocks.flatMap((block) =>
      Array.from({ length: block.operations.length + 1 }, (_, operation) =>
        Object.freeze({ block: block.id, operation }),
      ),
    ),
  );
}

/** Return every direct call span in one function. */
function functionCalls(fn: Pick<SemanticFunction, "blocks">) {
  return Object.freeze(
    fn.blocks.flatMap((block) =>
      block.operations.flatMap((operation) => (operation.kind === "call" ? [operation.span] : [])),
    ),
  );
}

/** Build a conservative declared-storage lifetime when no smaller source lifetime is retained. */
function declaredLifetime(
  fn: Pick<SemanticFunction, "id" | "entry" | "blocks">,
  value: string,
): ValueLifetime {
  const positions = functionPositions(fn);
  return Object.freeze({
    function: fn.id,
    value,
    definition: positions[0] ?? Object.freeze({ block: fn.entry, operation: 0 }),
    liveAt: positions,
    callsCrossed: functionCalls(fn),
  });
}

/** Return one operation's result type, when it defines a value. */
function resultType(operation: SemanticOperation): SemanticType | null {
  return "result" in operation && operation.result !== null ? operation.type : null;
}

/** Find the operation which defines a function-local semantic value. */
function definingOperation(
  fn: Pick<SemanticFunction, "blocks">,
  value: string,
): SemanticOperation | null {
  for (const block of fn.blocks) {
    for (const operation of block.operations) {
      if ("result" in operation && operation.result === value) return operation;
    }
  }
  return null;
}

/** Select the fixed scalar return ABI used by the current source type. */
function resultLocation(type: SemanticType): ResultLocation | null {
  if (type.kind !== "scalar" || type.name === "void") return null;
  return Object.freeze({ kind: type.name === "word" || type.name === "sword" ? "ax" : "a" });
}

/** Stable request identity for a source binding. */
function bindingRequestId(
  owner: BindingId,
  storageClass: StorageClass,
  binding: BindingId,
): string {
  return `${bindingIdentityKey(owner)}:${storageClass}:${bindingIdentityKey(binding)}`;
}

/** Stable request identity for a computed semantic value. */
function valueRequestId(owner: BindingId, storageClass: StorageClass, value: string): string {
  return `${bindingIdentityKey(owner)}:${storageClass}:${value}`;
}

/** Return a stable structural identity for one concrete semantic place. */
function placeKey(
  operation: Extract<SemanticOperation, { readonly kind: "load" | "store" }>,
): string {
  return JSON.stringify([
    bindingIdentityKey(operation.place.root),
    operation.place.path.map((part) =>
      part.kind === "field" ? [part.kind, part.name] : [part.kind, part.value],
    ),
  ]);
}

/** Determine whether a loaded scalar can be overwritten while its value remains live. */
function loadCrossesInvalidatingWrite(
  body: Pick<SemanticFunction, "blocks">,
  lifetime: ValueLifetime,
  load: Extract<SemanticOperation, { readonly kind: "load" }>,
): boolean {
  const loadedPlace = placeKey(load);
  for (const block of body.blocks) {
    for (let operationIndex = 0; operationIndex < block.operations.length; operationIndex += 1) {
      const operation = block.operations[operationIndex]!;
      if (operation.kind !== "store" || placeKey(operation) !== loadedPlace) continue;
      if (
        block.id === lifetime.definition.block &&
        operationIndex <= lifetime.definition.operation
      ) {
        continue;
      }
      if (
        lifetime.liveAt.some(
          (position) => position.block === block.id && position.operation >= operationIndex,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

/** Find the source place of a cast chain so a later write cannot change its value. */
function convertedLoad(
  body: Pick<SemanticFunction, "blocks">,
  operation: Extract<SemanticOperation, { readonly kind: "convert" }>,
): Extract<SemanticOperation, { readonly kind: "load" }> | null {
  const seen = new Set<string>();
  let operand = operation.operand;
  while (!seen.has(operand)) {
    seen.add(operand);
    const source = definingOperation(body, operand);
    if (source?.kind === "load") return source;
    if (source?.kind !== "convert") return null;
    operand = source.operand;
  }
  return null;
}

/** Compare requests without locale-dependent collation. */
function compareRequests(left: StorageRequest, right: StorageRequest): number {
  return Buffer.compare(Buffer.from(left.id), Buffer.from(right.id));
}

/** Add only computed values which must survive an invalidating operation. */
function appendCallStaging(
  owner: BindingId,
  body: Pick<SemanticFunction, "blocks">,
  lifetimes: readonly ValueLifetime[],
  requests: StorageRequest[],
): void {
  for (const lifetime of lifetimes) {
    if (bindingIdentityKey(lifetime.function) !== bindingIdentityKey(owner)) continue;
    const operation = definingOperation(body, lifetime.value);
    if (operation === null) continue;
    const type = resultType(operation);
    if (type === null || typeBytes(type) === 0) continue;
    const crossesCall = lifetime.callsCrossed.length > 0;
    const sourceLoad = operation.kind === "convert" ? convertedLoad(body, operation) : null;
    const crossesWrite =
      (operation.kind === "load" &&
        (type.kind === "scalar" || type.kind === "enum") &&
        loadCrossesInvalidatingWrite(body, lifetime, operation)) ||
      (sourceLoad !== null && loadCrossesInvalidatingWrite(body, lifetime, sourceLoad));
    if (!crossesCall && !crossesWrite) continue;
    const storageClass: StorageClass =
      operation.kind === "call" ? "return-stage" : "argument-stage";
    requests.push(
      Object.freeze({
        id: valueRequestId(owner, storageClass, lifetime.value),
        storageClass,
        owner,
        binding: null,
        value: lifetime.value,
        type,
        bytes: typeBytes(type),
        alignment: 1,
        region: "ram",
        lifetime,
        source: operation.span,
        reason:
          storageClass === "return-stage"
            ? "Call result survives a later call"
            : crossesCall
              ? "Evaluated value survives a nested call"
              : "Loaded value survives a write to its source place",
      }),
    );
  }
}

/** Add one finite low-byte home for each volatile word read. */
function appendWordReadLowBytes(
  owner: BindingId,
  body: Pick<SemanticFunction, "entry" | "blocks">,
  lifetimes: readonly ValueLifetime[],
  requests: StorageRequest[],
): void {
  for (const block of body.blocks) {
    for (const operation of block.operations) {
      if (operation.kind !== "memory-read" || operation.width !== 2) continue;
      const lifetime =
        lifetimes.find(
          (candidate) =>
            bindingIdentityKey(candidate.function) === bindingIdentityKey(owner) &&
            candidate.value === operation.result,
        ) ??
        declaredLifetime(
          Object.freeze({ id: owner, entry: body.entry, blocks: body.blocks }),
          operation.result,
        );
      requests.push(
        Object.freeze({
          id: valueRequestId(owner, "temporary", `word-read-low:${operation.result}`),
          storageClass: "temporary",
          owner,
          binding: null,
          value: operation.result,
          type: null,
          bytes: 1,
          alignment: 1,
          region: "ram",
          lifetime,
          source: operation.span,
          reason: "Low byte retained while the high byte is read",
        }),
      );
    }
  }
}

/** Build the minimum provisional SFA inventory required before machine binding. */
export function inventoryStorage(program: WholeProgram): StorageInventory {
  const requests: StorageRequest[] = [];
  const results: FunctionResultLocation[] = [];
  const functions = new Map(
    program.semantic.functions.map((fn) => [bindingIdentityKey(fn.id), fn] as const),
  );
  const globalKeys = new Set(program.semantic.globals.map(({ id }) => bindingIdentityKey(id)));

  for (const functionId of program.reachableFunctions) {
    const fn = functions.get(bindingIdentityKey(functionId));
    if (fn === undefined)
      throw new Error("Reachable function is absent from semantic storage input");
    const location = resultLocation(fn.result);
    if (location !== null) results.push(Object.freeze({ function: fn.id, location }));

    const parameterKeys = new Set<string>();
    for (const parameter of fn.parameters) {
      const key = bindingIdentityKey(parameter.id);
      parameterKeys.add(key);
      requests.push(
        Object.freeze({
          id: bindingRequestId(fn.id, "parameter", parameter.id),
          storageClass: "parameter",
          owner: fn.id,
          binding: parameter.id,
          value: null,
          type: parameter.type,
          bytes: typeBytes(parameter.type, true),
          alignment: 1,
          region: "ram",
          lifetime: declaredLifetime(fn, `parameter:${key}`),
          source: parameter.id.span,
          reason: "Static parameter home",
        }),
      );
    }

    const locals = new Map<string, { readonly id: BindingId; readonly type: SemanticType }>();
    for (const block of fn.blocks) {
      for (const operation of block.operations) {
        if (
          operation.kind !== "load" &&
          operation.kind !== "store" &&
          operation.kind !== "place-address"
        ) {
          continue;
        }
        const root = operation.place.root;
        const key = bindingIdentityKey(root);
        if (globalKeys.has(key) || parameterKeys.has(key)) continue;
        locals.set(key, { id: root, type: operation.place.rootType ?? operation.type });
      }
    }
    for (const [key, local] of locals) {
      requests.push(
        Object.freeze({
          id: bindingRequestId(fn.id, "local", local.id),
          storageClass: "local",
          owner: fn.id,
          binding: local.id,
          value: null,
          type: local.type,
          bytes: typeBytes(local.type),
          alignment: 1,
          region: "ram",
          lifetime: declaredLifetime(fn, `local:${key}`),
          source: local.id.span,
          reason: "Static local home",
        }),
      );
    }

    appendCallStaging(fn.id, fn, program.lifetimes, requests);
    appendWordReadLowBytes(fn.id, fn, program.lifetimes, requests);
  }

  const globals = new Map(
    program.semantic.globals.map((global) => [bindingIdentityKey(global.id), global] as const),
  );
  for (const initializer of program.initializers ?? []) {
    const global = globals.get(bindingIdentityKey(initializer.binding));
    if (global === undefined || global.entry === null) {
      throw new Error("Initializer execution is absent from semantic storage input");
    }
    appendCallStaging(initializer.binding, global, initializer.lifetimes, requests);
    appendWordReadLowBytes(
      initializer.binding,
      { entry: global.entry, blocks: global.blocks },
      initializer.lifetimes,
      requests,
    );
  }

  requests.sort(compareRequests);
  return Object.freeze({
    program,
    requests: Object.freeze(requests),
    results: Object.freeze(results),
  });
}
