import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { SemanticFunction, SemanticOperation } from "../semantic/operations.js";
import { interruptDepthAt, interruptExecutionContexts } from "../semantic/interrupt-contexts.js";
import type { InterruptExecutionContexts } from "../semantic/interrupt-contexts.js";
import {
  interruptExecutedBlocks,
  interruptMaterializations,
  interruptCodeContexts,
  interruptRetainedBlocks,
} from "../semantic/interrupt-context-facts.js";
import { valueLifetimes } from "../semantic/value-lifetimes.js";
import type { SemanticPosition, ValueLifetime, WholeProgram } from "../semantic/whole-program.js";
import type { ExecutionDomain } from "../semantic/interrupt-domains.js";
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
  if (type.kind === "function" || type.kind === "interrupt-handler") return 2;
  if (type.kind === "enum") return 1;
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
      block.operations.flatMap((operation) =>
        operation.kind === "call" || operation.kind === "indirect-call" ? [operation.span] : [],
      ),
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
  if (type.kind === "function") return Object.freeze({ kind: "ax" });
  if (type.kind !== "scalar" || type.name === "void") return null;
  return Object.freeze({ kind: type.name === "word" || type.name === "sword" ? "ax" : "a" });
}

/** Name one function's private storage namespace without changing legacy IDs. */
export function privateOwnerKey(
  owner: BindingId,
  domain?: ExecutionDomain,
  activationRoot?: string,
): string {
  const key = bindingIdentityKey(owner);
  return `${key}${domain === "irq" ? "@irq" : domain === "nmi" ? "@nmi" : ""}${activationRoot === undefined ? "" : `@${activationRoot}`}`;
}

/** Stable request identity for a source binding. */
function bindingRequestId(
  owner: BindingId,
  storageClass: StorageClass,
  binding: BindingId,
  domain?: ExecutionDomain,
  activationRoot?: string,
): string {
  return `${privateOwnerKey(owner, domain, activationRoot)}:${storageClass}:${bindingIdentityKey(binding)}`;
}

/** Stable request identity for a computed semantic value. */
function valueRequestId(
  owner: BindingId,
  storageClass: StorageClass,
  value: string,
  domain?: ExecutionDomain,
  activationRoot?: string,
): string {
  return `${privateOwnerKey(owner, domain, activationRoot)}:${storageClass}:${value}`;
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
  domain?: ExecutionDomain,
  activationRoot?: string,
): void {
  for (const lifetime of lifetimes) {
    if (bindingIdentityKey(lifetime.function) !== bindingIdentityKey(owner)) continue;
    const operation = definingOperation(body, lifetime.value);
    if (operation === null) continue;
    const type = resultType(operation);
    if (type === null || typeBytes(type) === 0) continue;
    // Aggregate parameters borrow an address. Calls and literals that produce a new
    // aggregate already request their caller-owned object from machine lowering.
    // Staging the full bytes here would reserve a second object that nothing reads.
    if (type.kind === "array" || type.kind === "struct") continue;
    const crossesCall = lifetime.callsCrossed.length > 0;
    const sourceLoad = operation.kind === "convert" ? convertedLoad(body, operation) : null;
    const crossesWrite =
      (operation.kind === "load" && loadCrossesInvalidatingWrite(body, lifetime, operation)) ||
      (sourceLoad !== null && loadCrossesInvalidatingWrite(body, lifetime, sourceLoad));
    if (!crossesCall && !crossesWrite) continue;
    const storageClass: StorageClass =
      operation.kind === "call" ? "return-stage" : "argument-stage";
    requests.push(
      Object.freeze({
        id: valueRequestId(owner, storageClass, lifetime.value, domain, activationRoot),
        storageClass,
        owner,
        ...(domain === undefined ? {} : { domain }),
        ...(activationRoot === undefined ? {} : { activationRoot }),
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
  domain?: ExecutionDomain,
  activationRoot?: string,
): void {
  const fixedAddresses = new Set(
    body.blocks.flatMap((block) =>
      block.operations.flatMap((operation) =>
        operation.kind === "constant" && typeof operation.value === "bigint"
          ? [operation.result]
          : [],
      ),
    ),
  );
  for (const block of body.blocks) {
    for (const operation of block.operations) {
      if (operation.kind !== "memory-read" || operation.width !== 2) continue;
      if (fixedAddresses.has(operation.address)) continue;
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
          id: valueRequestId(
            owner,
            "temporary",
            `word-read-low:${operation.result}`,
            domain,
            activationRoot,
          ),
          storageClass: "temporary",
          owner,
          ...(domain === undefined ? {} : { domain }),
          ...(activationRoot === undefined ? {} : { activationRoot }),
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

/** Identify selected IRQ installs reached from within a handler activation. */
export function hasHandlerSideIrqInstall(
  program: WholeProgram,
  contexts: InterruptExecutionContexts,
): boolean {
  const selectedInstalls = new Set<SemanticOperation>(
    (program.interruptRoutes ?? [])
      .filter((route) => route.sink.domain === "irq")
      .map((route) => route.installation),
  );
  return [...contexts].some(([key, entries]) => {
    const fn = program.semantic.functions.find(({ id }) => bindingIdentityKey(id) === key);
    return (
      fn !== undefined &&
      entries.some((context) => context.activationRoot !== undefined) &&
      fn.blocks.some((block) =>
        block.operations.some((operation) => selectedInstalls.has(operation)),
      )
    );
  });
}

/** Build the minimum provisional SFA inventory required before machine binding. */
export function inventoryStorage(program: WholeProgram): StorageInventory {
  const requests: StorageRequest[] = [];
  const results: FunctionResultLocation[] = [];
  const functions = new Map(
    program.semantic.functions.map((fn) => [bindingIdentityKey(fn.id), fn] as const),
  );
  const executed = interruptExecutionContexts(program);
  const retained = interruptMaterializations(program);
  const contexts = interruptCodeContexts(executed, retained.contexts);
  const hasHandlerInstall = hasHandlerSideIrqInstall(program, contexts);
  const hasNmiRoute = program.interruptRoutes?.some(({ sink }) => sink.domain === "nmi") === true;
  const proof = hasNmiRoute ? program.interruptContextAnalysis : undefined;
  if (hasNmiRoute && (proof === undefined || proof.diagnostics.length > 0))
    throw new Error("NMI storage requires complete installation-link proof");
  const selectedInstalls = new Set<SemanticOperation>(
    (program.interruptRoutes ?? [])
      .filter((route) => route.sink.domain === "irq")
      .map((route) => route.installation),
  );
  const globalKeys = new Set(program.semantic.globals.map(({ id }) => bindingIdentityKey(id)));

  for (const functionId of program.reachableFunctions) {
    const source = functions.get(bindingIdentityKey(functionId));
    if (source === undefined)
      throw new Error("Reachable function is absent from semantic storage input");
    const key = bindingIdentityKey(source.id);
    const entries = contexts.get(key) ?? [];
    // Initializer calls also reach ordinary helpers in main execution. Retain
    // those contexts alongside source roots so their homes agree with callers,
    // including a helper that is separately reachable from an IRQ.
    const reachedDomains = new Set([
      ...(proof === undefined
        ? (program.executionDomains?.find((entry) => bindingIdentityKey(entry.function) === key)
            ?.domains ?? [])
        : []),
      ...entries.map((entry) => entry.domain),
    ]);
    const domains: readonly (ExecutionDomain | undefined)[] =
      reachedDomains.size === 0 && proof === undefined ? [undefined] : [...reachedDomains];
    for (const domain of domains) {
      const roots =
        (domain === "irq" && hasHandlerInstall) || (domain !== undefined && proof !== undefined)
          ? [
              ...new Set(
                entries
                  .filter((context) => context.domain === domain)
                  .map((context) => context.activationRoot),
              ),
            ].sort()
          : [];
      for (const activationRoot of roots.length === 0 ? [undefined] : roots) {
        const blocks =
          proof === undefined
            ? source.blocks
            : retained.contexts
                  .get(key)
                  ?.some(
                    (entry) => entry.domain === domain && entry.activationRoot === activationRoot,
                  )
              ? interruptRetainedBlocks(source, program)
              : interruptExecutedBlocks(
                  source,
                  (executed.get(key) ?? []).filter(
                    (entry) => entry.domain === domain && entry.activationRoot === activationRoot,
                  ),
                  proof,
                );
        if (blocks.length === 0) continue;
        const fn = Object.freeze({ ...source, blocks });
        const lifetimes = proof === undefined ? program.lifetimes : valueLifetimes(fn);
        if (fn.result.kind === "array" || fn.result.kind === "struct") {
          const id = valueRequestId(
            fn.id,
            "pointer",
            "aggregate-return-destination",
            domain,
            activationRoot,
          );
          requests.push(
            Object.freeze({
              id,
              storageClass: "pointer",
              owner: fn.id,
              ...(domain === undefined ? {} : { domain }),
              ...(activationRoot === undefined ? {} : { activationRoot }),
              binding: null,
              value: "aggregate-return-destination",
              type: null,
              bytes: 2,
              alignment: 1,
              region: "zero-page-required",
              lifetime: declaredLifetime(fn, "aggregate-return-destination"),
              source: fn.source,
              reason: "Caller-owned fixed aggregate result address",
            }),
          );
          results.push(
            Object.freeze({
              function: fn.id,
              ...(domain === undefined ? {} : { domain }),
              ...(activationRoot === undefined ? {} : { activationRoot }),
              location: Object.freeze({ kind: "storage", requestId: id }),
            }),
          );
        } else {
          const location = resultLocation(fn.result);
          if (location !== null)
            results.push(
              Object.freeze({
                function: fn.id,
                ...(domain === undefined ? {} : { domain }),
                ...(activationRoot === undefined ? {} : { activationRoot }),
                location,
              }),
            );
        }

        const parameterKeys = new Set<string>();
        for (const parameter of fn.parameters) {
          const key = bindingIdentityKey(parameter.id);
          parameterKeys.add(key);
          requests.push(
            Object.freeze({
              id: bindingRequestId(fn.id, "parameter", parameter.id, domain, activationRoot),
              storageClass: "parameter",
              owner: fn.id,
              ...(domain === undefined ? {} : { domain }),
              ...(activationRoot === undefined ? {} : { activationRoot }),
              binding: parameter.id,
              value: null,
              type: parameter.type,
              bytes: parameter.outerUnsized ? 4 : typeBytes(parameter.type, true),
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
            if (operation.place.asset !== undefined) continue;
            const key = bindingIdentityKey(root);
            if (globalKeys.has(key) || parameterKeys.has(key)) continue;
            locals.set(key, { id: root, type: operation.place.rootType ?? operation.type });
          }
        }
        for (const [key, local] of locals) {
          requests.push(
            Object.freeze({
              id: bindingRequestId(fn.id, "local", local.id, domain, activationRoot),
              storageClass: "local",
              owner: fn.id,
              ...(domain === undefined ? {} : { domain }),
              ...(activationRoot === undefined ? {} : { activationRoot }),
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

        appendCallStaging(fn.id, fn, lifetimes, requests, domain, activationRoot);
        appendWordReadLowBytes(fn.id, fn, lifetimes, requests, domain, activationRoot);
      }
    }
  }

  const globals = new Map(
    program.semantic.globals.map((global) => [bindingIdentityKey(global.id), global] as const),
  );
  for (const initializer of program.initializers ?? []) {
    const source = globals.get(bindingIdentityKey(initializer.binding));
    if (source === undefined || source.entry === null) {
      throw new Error("Initializer execution is absent from semantic storage input");
    }
    const blocks =
      proof === undefined
        ? source.blocks
        : interruptExecutedBlocks(source, contexts.get(bindingIdentityKey(source.id)) ?? [], proof);
    if (blocks.length === 0) continue;
    const global = Object.freeze({ ...source, entry: source.entry, blocks });
    const lifetimes = proof === undefined ? initializer.lifetimes : valueLifetimes(global);
    // Initializers are mainline executions even when an earlier initializer
    // has armed a handler. Their saved values must interfere with IRQ homes.
    appendCallStaging(initializer.binding, global, lifetimes, requests, "main");
    appendWordReadLowBytes(
      initializer.binding,
      { entry: global.entry, blocks: global.blocks },
      lifetimes,
      requests,
      "main",
    );
  }

  const main = functions.get(bindingIdentityKey(program.semantic.main));
  if (proof !== undefined) {
    // The proof already separates mainline positions from handler-owned ones.
    // Every selected physical word remains reserved while an old route can read it.
    for (const binding of proof.bindings.values()) {
      const installer = binding.captures[0]?.installer;
      if (installer === undefined) throw new Error("Proved interrupt link has no capture");
      const root = installer.activationRoot;
      const owner =
        root === undefined
          ? main
          : (functions.get(root) ??
            program.semantic.functions.find(
              (fn) =>
                fn.entryKind === "interrupt" &&
                contexts
                  .get(bindingIdentityKey(fn.id))
                  ?.some((context) => context.activationRoot === root),
            ));
      if (owner === undefined) throw new Error("Proved interrupt link has no source owner");
      requests.push(
        Object.freeze({
          id: binding.requestId,
          storageClass: "pointer",
          owner: owner.id,
          domain: installer.domain,
          ...(root === undefined ? {} : { activationRoot: root }),
          binding: null,
          value: binding.requestId,
          type: null,
          bytes: 2,
          alignment: 1,
          region: "ram",
          pageSafeIndirect: true,
          persistent: true,
          lifetime: declaredLifetime(owner, binding.requestId),
          source: owner.source,
          reason: "Saved predecessor in a proved installation-owned word",
        }),
      );
    }
    // Retained code reserves a physical word, but never creates a proved capture
    // or infers that the erased external caller will preserve its lifetime.
    for (const link of retained.links.values()) {
      if (proof.bindings.has(link.requestId)) continue;
      const owner = functions.get(bindingIdentityKey(link.owner));
      if (owner === undefined) throw new Error("Retained interrupt link has no source owner");
      requests.push(
        Object.freeze({
          id: link.requestId,
          storageClass: "pointer",
          owner: owner.id,
          domain: link.context.domain,
          ...(link.context.activationRoot === undefined
            ? {}
            : { activationRoot: link.context.activationRoot }),
          binding: null,
          value: link.requestId,
          type: null,
          bytes: 2,
          alignment: 1,
          region: "ram",
          pageSafeIndirect: true,
          persistent: true,
          lifetime: declaredLifetime(owner, link.requestId),
          source: owner.source,
          reason: "Saved predecessor word for uncertified retained source code",
        }),
      );
    }
  }
  if (main !== undefined && proof === undefined) {
    for (const sink of ["irq", "nmi"] as const) {
      const maximum = program.interruptOwnership?.maxDepth[sink] ?? 0;
      for (let depth = 0; depth < maximum; depth += 1) {
        const value = `interrupt-link:${sink}:${depth}`;
        requests.push(
          Object.freeze({
            id: value,
            storageClass: "pointer",
            owner: main.id,
            domain: "main",
            binding: null,
            value,
            type: null,
            bytes: 2,
            alignment: 1,
            region: "ram",
            pageSafeIndirect: true,
            persistent: true,
            lifetime: declaredLifetime(main, value),
            source: main.source,
            reason: `Saved ${sink.toUpperCase()} predecessor at nesting depth ${depth}`,
          }),
        );
      }
    }
  }

  // A handler owns only its temporary install positions. The incoming vector
  // belongs to whichever execution it interrupted, so it is never a slot in
  // this root's local inventory.
  const localSlots = new Map<string, number>();
  for (const [functionKey, entries] of contexts) {
    if (proof !== undefined) break;
    const fn = functions.get(functionKey);
    if (fn === undefined) continue;
    for (const context of entries) {
      if (context.activationRoot === undefined) continue;
      for (const block of fn.blocks) {
        for (const operation of block.operations) {
          if (!selectedInstalls.has(operation)) continue;
          const depth = interruptDepthAt(context, operation, program).localIrqDepth ?? 0;
          localSlots.set(
            context.activationRoot,
            Math.max(localSlots.get(context.activationRoot) ?? 0, depth + 1),
          );
        }
      }
    }
  }
  for (const [root, count] of localSlots) {
    const owner = functions.get(root);
    if (owner === undefined) throw new Error("Selected IRQ root has no source function");
    for (let depth = 0; depth < count; depth += 1) {
      const value = `interrupt-link:irq:${root}:${depth}`;
      requests.push(
        Object.freeze({
          id: value,
          storageClass: "pointer",
          owner: owner.id,
          domain: "irq",
          activationRoot: root,
          binding: null,
          value,
          type: null,
          bytes: 2,
          alignment: 1,
          region: "ram",
          pageSafeIndirect: true,
          // Link liveness is proved from installed IRQ paths, not from every
          // source position in the handler's body.
          lifetime: Object.freeze({
            function: owner.id,
            value,
            definition: Object.freeze({ block: owner.entry, operation: 0 }),
            liveAt: Object.freeze([]),
            callsCrossed: Object.freeze([]),
          }),
          source: owner.source,
          reason: `Saved IRQ predecessor in handler-local slot ${depth}`,
        }),
      );
    }
  }

  requests.sort(compareRequests);
  return Object.freeze({
    program,
    requests: Object.freeze(requests),
    results: Object.freeze(results),
  });
}
