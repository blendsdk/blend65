import type { CompleteC64Layout } from "../artifacts/acme-validate.js";
import { acmeLabelName } from "../artifacts/acme-serializer.js";
import type { EvidenceRecord } from "../artifacts/evidence-types.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { ProjectSnapshot, SourceSpan } from "../project/types.js";
import type { SemanticFunction } from "../semantic/operations.js";
import type { IndirectTargetSets } from "../semantic/function-targets.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import type { StorageClosureCertificate, StorageInventory } from "../storage/storage-types.js";

/** Records derived from final compiler state for the indexed debug sidecar. */
export interface DerivedDebugRecords {
  /** Selected machine address spaces. */
  readonly addressSpaces: readonly EvidenceRecord[];
  /** Reachable source functions. */
  readonly functions: readonly EvidenceRecord[];
  /** Entry and finite source-call contexts. */
  readonly contexts: readonly EvidenceRecord[];
  /** Source and generated symbols with reverse location indexes. */
  readonly symbols: readonly EvidenceRecord[];
  /** Final symbol availability records. */
  readonly locations: readonly EvidenceRecord[];
  /** Reconciled machine ranges. */
  readonly ranges: readonly EvidenceRecord[];
}

interface DebugDerivationInput {
  readonly snapshot: ProjectSnapshot;
  readonly program: WholeProgram;
  readonly inventory: StorageInventory;
  readonly certificate: StorageClosureCertificate;
  readonly layout: CompleteC64Layout;
}

/** Return the stable debug identity of one reachable source function. */
export function functionName(fn: SemanticFunction): string {
  return `${fn.id.sourceId}::${fn.name ?? bindingIdentityKey(fn.id)}`;
}

/** Return the stable debug identity of one source global. */
export function globalName(binding: BindingId): string {
  return `global::${bindingIdentityKey(binding)}`;
}

/** Return the stable debug identity of one selected asset. */
export function assetSymbolName(assetId: string): string {
  return `asset::${assetId}`;
}

/** Compare stable UTF-8 identities without locale-dependent ordering. */
export function compareText(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

/** Convert a source span to its exact source-table index. */
function indexedSpan(span: SourceSpan, sourceIndexes: ReadonlyMap<string, number>): EvidenceRecord {
  const sourceIndex = sourceIndexes.get(span.sourceId);
  if (sourceIndex === undefined) throw new Error("Debug source span has no source inventory entry");
  return Object.freeze({ sourceIndex, startByte: span.start, endByte: span.end });
}

/** Render the exact represented semantic type using a valid canonical spelling. */
function typeText(type: SemanticType): string {
  if (type.kind === "scalar") return type.name;
  if (type.kind === "array") {
    const element = typeText(type.element);
    return `${type.element.kind === "function" ? `(${element})` : element}[${type.length}]`;
  }
  if (type.kind === "enum") return type.name;
  if (type.kind === "function")
    return `fn(${type.parameters
      .map(
        ({ type: parameter, readonly, outerUnsized }) =>
          `${readonly ? "const " : ""}${outerUnsized && parameter.kind === "array" ? `${typeText(parameter.element)}[]` : typeText(parameter)}`,
      )
      .join(", ")}): ${typeText(type.returnType)}`;
  if (type.kind === "interrupt-handler") return "interrupt-handler";
  return `Struct_${Buffer.from(bindingIdentityKey(type.binding), "utf8").toString("hex")}`;
}

/** Return outer array extents in the same order as the canonical type spelling. */
function typeShape(type: SemanticType): readonly number[] {
  return type.kind === "array"
    ? Object.freeze([...typeShape(type.element), type.length])
    : Object.freeze([]);
}

/** Return the exact in-memory width of one semantic value. */
function typeBytes(type: SemanticType): number {
  if (type.kind === "array" || type.kind === "struct") return type.size;
  if (type.kind === "function" || type.kind === "interrupt-handler") return 2;
  if (type.kind === "enum") return 1;
  if (type.name === "void") return 0;
  return type.name === "word" || type.name === "sword" ? 2 : 1;
}

/** Return the exact selected byte length of one final machine function. */
export function machineFunctionRange(fn: CompleteC64Layout["program"]["functions"][number]): {
  readonly start: number;
  readonly end: number;
} {
  const start = fn.origin;
  if (start === undefined) throw new Error("Final machine function has no origin");
  let end = start;
  for (const block of fn.blocks) {
    if (block.origin === undefined) throw new Error("Final machine block has no origin");
    let bytes = block.instructions.reduce((sum, instruction) => sum + instruction.cost.bytes, 0);
    const terminator = block.terminator;
    if (terminator.kind === "branch") bytes += 2;
    else if (terminator.kind === "long-branch") bytes += 5;
    else if (terminator.kind === "jump") bytes += 3;
    else if (terminator.kind === "return") bytes += terminator.cost?.bytes ?? 1;
    end = Math.max(end, block.origin + bytes);
  }
  if (end <= start) throw new Error("Final machine function has no emitted range");
  return Object.freeze({ start, end });
}

/** Return the exact selected byte range of one final machine block. */
export function machineBlockRange(
  block: CompleteC64Layout["program"]["functions"][number]["blocks"][number],
): { readonly start: number; readonly end: number } {
  if (block.origin === undefined) throw new Error("Final machine block has no origin");
  let bytes = block.instructions.reduce((sum, instruction) => sum + instruction.cost.bytes, 0);
  const terminator = block.terminator;
  if (terminator.kind === "branch") bytes += 2;
  else if (terminator.kind === "long-branch") bytes += 5;
  else if (terminator.kind === "jump") bytes += 3;
  else if (terminator.kind === "return") bytes += terminator.cost?.bytes ?? 1;
  if (bytes <= 0) throw new Error("Final machine block has no emitted range");
  return Object.freeze({ start: block.origin, end: block.origin + bytes });
}

/** Return whether two retained source spans identify the same source bytes. */
function sameSpan(left: SourceSpan | null, right: SourceSpan): boolean {
  return (
    left !== null &&
    left.sourceId === right.sourceId &&
    left.start === right.start &&
    left.end === right.end
  );
}

/** Return the exact emitted byte count of one final machine terminator. */
function terminatorBytes(
  terminator: CompleteC64Layout["program"]["functions"][number]["blocks"][number]["terminator"],
): number {
  if (terminator.kind === "branch") return 2;
  if (terminator.kind === "long-branch") return 5;
  if (terminator.kind === "jump") return 3;
  if (terminator.kind === "return") return terminator.cost?.bytes ?? 1;
  return 0;
}

/** Map final instruction bytes back to their retained semantic CFG positions. */
function machineFunctionSegments(
  machine: CompleteC64Layout["program"]["functions"][number],
  semantic: Pick<SemanticFunction, "blocks" | "source">,
): readonly {
  readonly start: number;
  readonly end: number;
  readonly block: string;
  readonly operation: number | null;
  readonly source: SourceSpan;
}[] {
  const segments: {
    readonly start: number;
    readonly end: number;
    readonly block: string;
    readonly operation: number | null;
    readonly source: SourceSpan;
  }[] = [];
  for (const block of machine.blocks) {
    if (block.origin === undefined) throw new Error("Final machine block has no origin");
    const sourceBlock = semantic.blocks.find(
      ({ id }) =>
        block.label === id ||
        block.label.startsWith(`${id}.wait.`) ||
        block.label.startsWith(`${id}.shift.`) ||
        block.label.startsWith(`${id}.multiply.`) ||
        block.label.startsWith(`${id}.divide.`) ||
        block.label.startsWith(`${id}.copy.`) ||
        block.label.startsWith(`${id}.move.`) ||
        block.label.startsWith(`${id}.fill.`) ||
        block.label.startsWith(`${id}.indirect.`) ||
        block.label.startsWith(`${id}.bounds.`),
    );
    if (sourceBlock === undefined) throw new Error("Final machine block has no semantic CFG owner");
    let address = block.origin;
    for (const instruction of block.instructions) {
      const operation = sourceBlock.operations.findIndex((candidate) =>
        sameSpan(instruction.source, candidate.span),
      );
      segments.push(
        Object.freeze({
          start: address,
          end: address + instruction.cost.bytes,
          block: sourceBlock.id,
          operation: operation < 0 ? null : operation,
          source: instruction.source ?? semantic.source,
        }),
      );
      address += instruction.cost.bytes;
    }
    const bytes = terminatorBytes(block.terminator);
    if (bytes > 0) {
      segments.push(
        Object.freeze({
          start: address,
          end: address + bytes,
          block: sourceBlock.id,
          operation: sourceBlock.operations.length,
          source: semantic.source,
        }),
      );
    }
  }
  return Object.freeze(segments);
}

/** Return every source call edge, including each finite indirect candidate. */
function callsIn(
  fn: Pick<SemanticFunction, "blocks">,
  indirectTargets: IndirectTargetSets | undefined,
): readonly { readonly callee: BindingId; readonly span: SourceSpan }[] {
  return Object.freeze(
    fn.blocks.flatMap((block) =>
      block.operations.flatMap((operation) => {
        if (operation.kind === "call") return [{ callee: operation.callee, span: operation.span }];
        if (operation.kind !== "indirect-call") return [];
        return (indirectTargets?.get(operation) ?? []).map((callee) => ({
          callee,
          span: operation.span,
        }));
      }),
    ),
  );
}

/** Build the first-producer debug graph from final semantic, storage, layout, and label facts. */
export function deriveDebugRecords(input: DebugDerivationInput): DerivedDebugRecords {
  const sourceIndexes = new Map(
    input.snapshot.sources.map((source, index) => [source.sourceId, index] as const),
  );
  const reachable = new Set(input.program.reachableFunctions.map(bindingIdentityKey));
  const semanticFunctions = input.program.semantic.functions.filter((fn) =>
    reachable.has(bindingIdentityKey(fn.id)),
  );
  const globalsByKey = new Map(
    input.program.semantic.globals.map(
      (global) => [bindingIdentityKey(global.id), global] as const,
    ),
  );
  const executionFunctions = [
    ...semanticFunctions.map((fn) =>
      Object.freeze({
        binding: fn.id,
        qualifiedName: functionName(fn),
        source: fn.source,
        machineId: `fn.${bindingIdentityKey(fn.id)}`,
        body: fn,
      }),
    ),
    ...(input.program.initializers ?? []).flatMap((initializer) => {
      const global = globalsByKey.get(bindingIdentityKey(initializer.binding));
      if (global === undefined) throw new Error("Initializer has no semantic global");
      if (global.initialBytes !== null || global.runtimeInitialBytes !== null) return [];
      return [
        Object.freeze({
          binding: initializer.binding,
          qualifiedName: `initializer::${bindingIdentityKey(initializer.binding)}`,
          source: global.source,
          machineId: `init.${bindingIdentityKey(initializer.binding)}`,
          body: global,
        }),
      ];
    }),
  ].sort((left, right) => compareText(left.qualifiedName, right.qualifiedName));
  const functionIndexes = new Map(
    executionFunctions.map((fn, index) => [bindingIdentityKey(fn.binding), index] as const),
  );
  const machineFunctions = new Map(
    input.layout.program.functions.map((fn) => [fn.id, fn] as const),
  );

  const rangeDrafts: {
    readonly start: number;
    readonly end: number;
    readonly functionIndex?: number;
    readonly semanticBlock?: string;
    readonly semanticOperation?: number | null;
    readonly origin: EvidenceRecord;
    readonly owner: EvidenceRecord;
    readonly contextIndex?: number;
  }[] = [];
  for (const block of input.layout.program.startup.blocks) {
    rangeDrafts.push({
      ...machineBlockRange(block),
      origin: Object.freeze({ kind: "generated", cause: "startup" }),
      owner: Object.freeze({ kind: "platform", name: "startup" }),
    });
  }
  for (const [functionIndex, fn] of executionFunctions.entries()) {
    const machine = machineFunctions.get(fn.machineId);
    if (machine === undefined) throw new Error("Reachable function has no final machine function");
    for (const segment of machineFunctionSegments(machine, fn.body)) {
      rangeDrafts.push({
        start: segment.start,
        end: segment.end,
        functionIndex,
        semanticBlock: segment.block,
        semanticOperation: segment.operation,
        contextIndex: functionIndex,
        origin: Object.freeze({
          kind: "source",
          span: indexedSpan(segment.source, sourceIndexes),
        }),
        owner: Object.freeze({ kind: "function", functionIndex }),
      });
    }
  }
  rangeDrafts.sort((left, right) => left.start - right.start || left.end - right.end);
  const ranges = Object.freeze(
    rangeDrafts.map((range) =>
      Object.freeze({
        machine: Object.freeze({ addressSpaceIndex: 0, start: range.start, end: range.end }),
        origin: range.origin,
        owner: range.owner,
        optimizationIndexes: Object.freeze([]),
        ...(range.contextIndex === undefined ? {} : { contextIndex: range.contextIndex }),
      }),
    ),
  );
  const functionRangeIndexes = new Map<number, number[]>();
  rangeDrafts.forEach((range, index) => {
    if (range.functionIndex === undefined) return;
    const indexes = functionRangeIndexes.get(range.functionIndex) ?? [];
    indexes.push(index);
    functionRangeIndexes.set(range.functionIndex, indexes);
  });

  const functions = Object.freeze(
    executionFunctions.map((fn, functionIndex) => {
      const rangeIndexes = functionRangeIndexes.get(functionIndex);
      if (rangeIndexes === undefined || rangeIndexes.length === 0) {
        throw new Error("Reachable function has no debug range");
      }
      return Object.freeze({
        qualifiedName: fn.qualifiedName,
        kind: "ordinary",
        declaration: indexedSpan(fn.source, sourceIndexes),
        entryVariants: Object.freeze([
          Object.freeze({
            id: "default",
            kind: "ordinary",
            label: acmeLabelName(fn.machineId),
            rangeIndexes: Object.freeze([...rangeIndexes]),
          }),
        ]),
        rangeIndexes: Object.freeze([...rangeIndexes]),
      });
    }),
  );

  const entryContexts = executionFunctions.map((_, functionIndex) =>
    Object.freeze({ kind: "entry", functionIndex, entryVariantIndex: 0 }),
  );
  const callContexts = executionFunctions.flatMap((fn, callerIndex) =>
    callsIn(fn.body, input.program.indirectTargets).flatMap((call) => {
      const functionIndex = functionIndexes.get(bindingIdentityKey(call.callee));
      return functionIndex === undefined
        ? []
        : [
            Object.freeze({
              kind: "call",
              functionIndex,
              parentContextIndex: callerIndex,
              callSite: indexedSpan(call.span, sourceIndexes),
            }),
          ];
    }),
  );
  callContexts.sort((left, right) => {
    const leftSite = left.callSite as EvidenceRecord;
    const rightSite = right.callSite as EvidenceRecord;
    return (
      left.parentContextIndex - right.parentContextIndex ||
      (leftSite.sourceIndex as number) - (rightSite.sourceIndex as number) ||
      (leftSite.startByte as number) - (rightSite.startByte as number) ||
      (leftSite.endByte as number) - (rightSite.endByte as number) ||
      left.functionIndex - right.functionIndex
    );
  });
  const contexts = Object.freeze([...entryContexts, ...callContexts]);

  const homes = new Map(input.certificate.homes.map((home) => [home.requestId, home] as const));
  const symbolDrafts: {
    readonly name: string;
    readonly qualifiedName: string;
    readonly kind: string;
    readonly type: string;
    readonly byteWidth: number;
    readonly shape: readonly number[];
    readonly scope: string;
    readonly origin: EvidenceRecord;
    readonly linkage: string;
    readonly labels: readonly string[];
    readonly contextIndex?: number;
    readonly liveRangeIndexes: readonly number[];
    readonly availability: EvidenceRecord;
  }[] = [];
  for (const fn of semanticFunctions) {
    const functionIndex = functionIndexes.get(bindingIdentityKey(fn.id));
    if (functionIndex === undefined) throw new Error("Source function has no debug context");
    const machine = machineFunctions.get(`fn.${bindingIdentityKey(fn.id)}`)!;
    const address = machine.origin!;
    const qualifiedName = String(functions[functionIndex]!.qualifiedName);
    symbolDrafts.push({
      name: fn.name ?? bindingIdentityKey(fn.id),
      qualifiedName,
      kind: "function",
      type: `fn(${fn.parameters.map(({ type }) => typeText(type)).join(", ")}): ${typeText(fn.result)}`,
      byteWidth: 2,
      shape: Object.freeze([]),
      scope: fn.id.sourceId,
      origin: Object.freeze({ kind: "source", span: indexedSpan(fn.source, sourceIndexes) }),
      linkage: "internal",
      labels: Object.freeze([acmeLabelName(machine.id)]),
      liveRangeIndexes: Object.freeze([]),
      availability: Object.freeze({
        kind: "constant",
        bytesHex: `${(address & 0xff).toString(16).padStart(2, "0")}${(address >>> 8)
          .toString(16)
          .padStart(2, "0")}`,
      }),
    });
  }
  for (const global of input.program.semantic.globals) {
    const interval = input.layout.intervals.find(
      ({ id }) => id === `global.${bindingIdentityKey(global.id)}`,
    );
    if (interval === undefined) continue;
    symbolDrafts.push({
      name: bindingIdentityKey(global.id),
      qualifiedName: globalName(global.id),
      kind: "global",
      type: typeText(global.type),
      byteWidth: typeBytes(global.type),
      shape: typeShape(global.type),
      scope: global.id.sourceId,
      origin: Object.freeze({ kind: "source", span: indexedSpan(global.source, sourceIndexes) }),
      linkage: "internal",
      labels: Object.freeze([acmeLabelName(interval.id)]),
      liveRangeIndexes: Object.freeze([]),
      availability: Object.freeze({
        kind: "available",
        pieces: Object.freeze([
          Object.freeze({
            kind: "memory",
            machine: Object.freeze({
              addressSpaceIndex: 0,
              start: interval.start,
              end: interval.end + 1,
            }),
            valueOffset: 0,
            byteLength: interval.end - interval.start + 1,
          }),
        ]),
      }),
    });
  }
  for (const asset of input.program.semantic.assets.filter(({ id }) =>
    input.program.reachableAssets.includes(id),
  )) {
    const interval = input.layout.intervals.find(({ id }) => id === `asset.${asset.id}`);
    if (interval === undefined) continue;
    symbolDrafts.push({
      name: asset.id,
      qualifiedName: assetSymbolName(asset.id),
      kind: "asset",
      type: `byte[${asset.bytes.length}]`,
      byteWidth: asset.bytes.length,
      shape: Object.freeze([asset.bytes.length]),
      scope: "asset",
      origin: Object.freeze({ kind: "generated", cause: "asset" }),
      linkage: "internal",
      labels: Object.freeze([acmeLabelName(interval.id)]),
      liveRangeIndexes: Object.freeze([]),
      availability: Object.freeze({
        kind: "available",
        pieces: Object.freeze([
          Object.freeze({
            kind: "memory",
            machine: Object.freeze({
              addressSpaceIndex: 0,
              start: interval.start,
              end: interval.end + 1,
            }),
            valueOffset: 0,
            byteLength: interval.end - interval.start + 1,
          }),
        ]),
      }),
    });
  }
  const helperScratchIds = new Set(
    input.certificate.helperCalls.flatMap(({ helperRequestIds }) => helperRequestIds),
  );
  for (const request of input.inventory.requests) {
    // Helper scratch belongs to the memory ledger, not a source-level debug location.
    if (helperScratchIds.has(request.id)) continue;
    const functionIndex = functionIndexes.get(bindingIdentityKey(request.owner));
    const home = homes.get(request.id);
    const functionRanges =
      functionIndex === undefined ? undefined : functionRangeIndexes.get(functionIndex);
    if (functionIndex === undefined || home === undefined || functionRanges === undefined) continue;
    const livePositions = new Set(
      request.lifetime.liveAt.map(({ block, operation }) => `${block}\0${operation}`),
    );
    const liveRangeIndexes = functionRanges.filter((rangeIndex) => {
      const range = rangeDrafts[rangeIndex]!;
      if (range.semanticBlock === undefined || range.semanticOperation === null) return false;
      return livePositions.has(`${range.semanticBlock}\0${range.semanticOperation}`);
    });
    if (liveRangeIndexes.length === 0) {
      throw new Error("Storage request lifetime has no final machine range");
    }
    const kind =
      request.storageClass === "parameter"
        ? "parameter"
        : request.storageClass === "local"
          ? "local"
          : request.storageClass === "return-stage"
            ? "return"
            : request.storageClass === "helper-scratch"
              ? "helperScratch"
              : "temporary";
    const type = request.type ?? ({ kind: "scalar", name: "byte" } as const);
    const ownerName = String(functions[functionIndex]!.qualifiedName);
    symbolDrafts.push({
      name: request.binding === null ? request.id : bindingIdentityKey(request.binding),
      qualifiedName: `${ownerName}::${request.id}`,
      kind,
      type: typeText(type),
      byteWidth: request.bytes,
      shape: request.type === null ? Object.freeze([]) : typeShape(request.type),
      scope: ownerName,
      origin:
        request.source === null
          ? Object.freeze({ kind: "generated", cause: "helper" })
          : Object.freeze({ kind: "source", span: indexedSpan(request.source, sourceIndexes) }),
      linkage: "internal",
      labels: Object.freeze([]),
      contextIndex: functionIndex,
      liveRangeIndexes: Object.freeze(liveRangeIndexes),
      availability:
        home.bytes === 0
          ? Object.freeze({ kind: "optimizedAway", rule: "zero-byte position marker" })
          : Object.freeze({
              kind: "available",
              pieces: Object.freeze([
                Object.freeze({
                  kind: "memory",
                  machine: Object.freeze({
                    addressSpaceIndex: 0,
                    start: home.address,
                    end: home.address + home.bytes,
                  }),
                  valueOffset: 0,
                  byteLength: home.bytes,
                }),
              ]),
            }),
    });
  }
  symbolDrafts.sort((left, right) =>
    compareText(
      `${left.qualifiedName}\0${left.kind}\0${JSON.stringify(left.origin)}`,
      `${right.qualifiedName}\0${right.kind}\0${JSON.stringify(right.origin)}`,
    ),
  );
  const symbols = Object.freeze(
    symbolDrafts.map((symbol, symbolIndex) =>
      Object.freeze({
        name: symbol.name,
        qualifiedName: symbol.qualifiedName,
        kind: symbol.kind,
        type: symbol.type,
        byteWidth: symbol.byteWidth,
        shape: symbol.shape,
        scope: symbol.scope,
        origin: symbol.origin,
        linkage: symbol.linkage,
        labels: symbol.labels,
        locationIndexes: Object.freeze([symbolIndex]),
      }),
    ),
  );
  const locations = Object.freeze(
    symbolDrafts.map((symbol, symbolIndex) =>
      Object.freeze({
        symbolIndex,
        liveRangeIndexes: symbol.liveRangeIndexes,
        availability: symbol.availability,
        ...(symbol.contextIndex === undefined ? {} : { contextIndex: symbol.contextIndex }),
      }),
    ),
  );

  return Object.freeze({
    addressSpaces: Object.freeze([
      Object.freeze({ id: "cpu16", kind: "cpu", sizeBytes: 0x10000, banks: Object.freeze([]) }),
    ]),
    functions,
    contexts,
    symbols,
    locations,
    ranges,
  });
}
