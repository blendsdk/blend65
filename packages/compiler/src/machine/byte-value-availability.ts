import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type { ExecutionDomain } from "../semantic/interrupt-domains.js";
import type { LoadOperation, SemanticOperation, UnaryOperation } from "../semantic/operations.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import type { TargetProfile } from "../target/profile.js";
import {
  valueDefinitions,
  createGlobalByteStabilityQuery,
} from "../semantic/aggregate-place-proof.js";
import { reachableBlocks } from "../semantic/value-lifetimes.js";
import type { LoweredValue } from "./lower-control.js";
import {
  byteContinuationQuery,
  BYTE_WINDOW_CHANGED,
  machineSuccessors as successors,
  machineInstruction,
} from "./lower-control.js";
import { loweredPlace, typeBytes, type FunctionLoweringState } from "./lower-state.js";
import type { CpuFacts } from "../target/nmos6510.js";
import { valuePreservingByteEquality } from "./lower-comparison.js";
import type {
  MachineBlock,
  MachineFunction,
  MachineInstruction,
  MachineFunctionSourceFacts,
  ByteWindowAddress,
  ByteAvailabilityProof,
  ByteAvailabilityInput,
  NativeStoreProof,
} from "./machine-types.js";

/** Runtime code-free classification stays with the unary emission owner. */
export { byteComplementNoCode } from "./lower-unary.js";
/** Preserve the bounded-prefix entry points while their common control owner serves loop selection too. */
export { byteContinuationQuery, BYTE_WINDOW_CHANGED } from "./lower-control.js";

/** Preserve existing proof entry points while their representation types share the common owner. */
export type {
  ByteWindowAddress,
  ByteAvailabilityProof,
  ByteAvailabilityInput,
} from "./machine-types.js";

/** Preserve only ordinary direct byte operands; volatile/indexed/indirect reads keep their loads. */
function byteAddress(instruction: MachineInstruction): ByteWindowAddress | null {
  if (
    !["storage", "absolute", "zero-page"].includes(instruction.mode) ||
    instruction.memory.some((effect) => effect.volatile)
  )
    return null;
  const operand = instruction.operand;
  if (operand?.kind === "storage" && operand.addressByte === undefined)
    return Object.freeze({ kind: "home", id: operand.requestId, offset: operand.offset ?? 0 });
  if (
    operand?.kind === "label" &&
    operand.addressByte === undefined &&
    operand.transform === undefined
  )
    return Object.freeze({ kind: "symbol", id: operand.label, offset: operand.offset ?? 0 });
  return null;
}

/** Byte identity equality is independent of host locale and final allocation. */
function sameAddress(left: ByteWindowAddress, right: ByteWindowAddress): boolean {
  return left.kind === right.kind && left.id === right.id && left.offset === right.offset;
}

/**
 * Prove A/flag ownership for one exact CMP short edge without discharging memory observers.
 * CMP leaves A unchanged and owns Z. A matching AND consumes A before clobbering
 * N/Z itself; no call, status restore, setup instruction or alternative entry may intervene.
 * @param input Actual structured instructions, source owner and complete incoming-edge facts.
 * @returns A source-associated conditional proof, or null for ordinary lowering.
 */
function proveWindow(
  input: ByteAvailabilityInput,
  safePrefix: ReturnType<typeof byteContinuationQuery>,
): ByteAvailabilityProof | null {
  const { producer, consumer } = input;
  const branch = producer.terminator;
  if (
    input.domain !== "main" ||
    input.externallyEntered ||
    input.incomingEdges !== 1 ||
    branch.kind !== "branch" ||
    !["beq", "bne"].includes(branch.opcode) ||
    !branch.uses.flags.includes("z") ||
    (branch.target !== consumer.label && branch.fallthrough !== consumer.label)
  )
    return null;
  const comparison = producer.instructions.at(-1);
  const load = producer.instructions.at(-2);
  const reload = consumer.instructions[0];
  const use = consumer.instructions[1];
  if (
    comparison?.opcode !== "eor" ||
    load?.opcode !== "lda" ||
    reload?.opcode !== "lda" ||
    use?.opcode !== "and" ||
    comparison.source === null ||
    use.source === null ||
    !load.defines.registers.includes("a") ||
    !comparison.defines.flags.includes("z") ||
    !comparison.defines.registers.includes("a") ||
    !use.uses.registers.includes("a")
  )
    return null;
  const left = byteAddress(load);
  const repeated = byteAddress(reload);
  const right = byteAddress(comparison);
  const consumed = byteAddress(use);
  if (
    left === null ||
    repeated === null ||
    right === null ||
    consumed === null ||
    !sameAddress(left, repeated) ||
    !sameAddress(right, consumed)
  )
    return null;
  const sibling = branch.target === consumer.label ? branch.fallthrough : branch.target;
  if (
    !safePrefix(consumer.label, 2, BYTE_WINDOW_CHANGED.c) ||
    !safePrefix(sibling, 0, BYTE_WINDOW_CHANGED.a | BYTE_WINDOW_CHANGED.n | BYTE_WINDOW_CHANGED.c)
  )
    return null;
  return Object.freeze({
    function: input.function,
    domain: "main",
    producer: comparison.source,
    consumer: use.source,
    from: producer.label,
    to: consumer.label,
    left,
    right,
    // Z agrees at the comparison and after AND, but omitting the intermediate
    // LDA can change transient Z observed by a physical/asynchronous stack reader.
    changedState: Object.freeze(["a", "n", "z", "c"] as const),
    pendingObservers: true,
  });
}

/**
 * Prove one complete register/flag/sibling context, retaining physical A/P/read obligations.
 * @param input Actual reference instructions and complete owning function.
 * @returns A conditional window proof, or null for ordinary equality and reloads.
 */
export function proveByteAvailability(input: ByteAvailabilityInput): ByteAvailabilityProof | null {
  return proveWindow(input, byteContinuationQuery(input.blocks));
}

/**
 * Coalesce exact source arithmetic/private-store/reload/native-store windows.
 * All candidate removals precede N/Z continuation proofs. Added restorations can
 * only kill those differences; no removed home or asynchronous interval is waived.
 * @param fn Original machine body, including all continuations and exits.
 * @param state Exact source operations, declared requests and native counter consumers.
 * @returns The original body or conditional windows with complete observer provenance.
 */
function selectNativeStoreWindows(
  fn: MachineFunction,
  state: FunctionLoweringState,
): MachineFunction {
  const runtime = state.fixedLoops;
  const source = state.sourceFacts?.function;
  if (
    runtime === undefined ||
    source === undefined ||
    runtime.indexViews.size === 0 ||
    state.interruptDepth.domain !== "main" ||
    state.input.sourceFacts?.nonLoopBundle !== "closed"
  )
    return fn;
  const definitions = valueDefinitions(source.blocks);
  const requests = new Map(state.requests.map((request) => [request.id, request]));
  const arithmetic = new Map<string, NativeStoreProof["arithmetic"]>();
  for (const operation of definitions.values()) {
    if (
      operation.kind !== "binary" ||
      !["+", "-"].includes(operation.operator) ||
      typeBytes(operation.type) !== 1 ||
      !state.singleUseValues.has(operation.result)
    )
      continue;
    const id = `machine:${bindingIdentityKey(state.owner)}:retained-value:${operation.result}`;
    const request = requests.get(id);
    if (
      request?.bytes === 1 &&
      request.storageClass === "temporary" &&
      request.owner === state.owner &&
      request.source === operation.span
    )
      arithmetic.set(id, operation);
  }
  const consumers = new Map<
    SourceSpan,
    { operation: NativeStoreProof["consumer"]; register: "x" | "y" } | null
  >();
  for (const view of runtime.indexViews.values()) {
    if (view.consumer.kind !== "store" || view.counter.register === null) continue;
    const span = view.consumer.span;
    consumers.set(
      span,
      consumers.has(span) ? null : { operation: view.consumer, register: view.counter.register },
    );
  }
  const windows = new Map<string, { start: number; proof: NativeStoreProof }[]>();
  const candidate = fn.blocks.map((block) => {
    const instructions: MachineInstruction[] = [];
    const found: { start: number; proof: NativeStoreProof }[] = [];
    for (let index = 0; index < block.instructions.length; index += 1) {
      const capture = block.instructions[index]!;
      const reload = block.instructions[index + 1];
      const write = block.instructions[index + 2];
      const read = block.instructions[index + 3];
      const use = block.instructions[index + 4];
      const captured = byteAddress(capture);
      const operation = captured?.kind === "home" ? arithmetic.get(captured.id) : undefined;
      const native = use?.source == null ? undefined : consumers.get(use.source);
      const writerUses =
        operation === undefined ? undefined : runtime.consumers.get(operation.result);
      const writer = writerUses?.length === 1 ? writerUses[0] : undefined;
      const reader = native == null ? undefined : definitions.get(native.operation.value);
      const delivered = write === undefined ? null : byteAddress(write);
      const repeated = read === undefined ? null : byteAddress(read);
      const sampled = reload === undefined ? null : byteAddress(reload);
      const variable =
        writer?.kind === "store" && writer.place.path.length === 0
          ? loweredPlace(writer.place, 1, false, state)
          : null;
      if (
        operation !== undefined &&
        native != null &&
        writer?.kind === "store" &&
        typeBytes(writer.type) === 1 &&
        reader?.kind === "load" &&
        reader.place.path.length === 0 &&
        typeBytes(reader.type) === 1 &&
        state.singleUseValues.has(reader.result) &&
        bindingIdentityKey(reader.place.root) === bindingIdentityKey(writer.place.root) &&
        capture.opcode === "sta" &&
        reload?.opcode === "lda" &&
        write?.opcode === "sta" &&
        read?.opcode === "lda" &&
        use?.opcode === "sta" &&
        block.instructions[index - 1]?.opcode === (operation.operator === "+" ? "adc" : "sbc") &&
        block.instructions[index - 1]?.source === operation.span &&
        capture.source === operation.span &&
        write.source === writer.span &&
        // A deferred source read is emitted by its exact native consumer.
        (read.source === reader.span || read.source === native.operation.span) &&
        use.mode === `absolute-${native.register}` &&
        captured?.kind === "home" &&
        captured.offset === 0 &&
        sampled !== null &&
        sameAddress(captured, sampled) &&
        delivered?.kind === "home" &&
        repeated !== null &&
        sameAddress(delivered, repeated) &&
        captured.id !== delivered.id &&
        variable?.kind === "storage" &&
        variable.requestId === delivered.id &&
        (variable.offset ?? 0) === delivered.offset &&
        [capture, reload, write, read, use].every((instruction) => instruction.memory.length === 0)
      ) {
        found.push({
          start: instructions.length,
          proof: Object.freeze({
            function: state.owner,
            domain: "main",
            context: fn.id,
            block: block.label,
            arithmetic: operation,
            write: writer,
            read: reader,
            consumer: native.operation,
            captureRequestId: captured.id,
            variableRequestId: delivered.id,
            removed: Object.freeze([capture, reload, read]),
            restoresFlags: false,
            changedState: Object.freeze(["n", "z"] as const),
            pendingObservers: true,
          }),
        });
        instructions.push(write, use);
        index += 4;
      } else instructions.push(capture);
    }
    if (found.length === 0) return block;
    windows.set(block.label, found);
    return Object.freeze({ ...block, instructions: Object.freeze(instructions) });
  });
  if (windows.size === 0) return fn;
  const safe = byteContinuationQuery(new Map(candidate.map((block) => [block.label, block])));
  const proofs: NativeStoreProof[] = [];
  const blocks = candidate.map((block) => {
    const selected = windows.get(block.label);
    if (selected === undefined) return block;
    const instructions = [...block.instructions];
    for (const window of [...selected].reverse()) {
      const restoresFlags = !safe(
        block.label,
        window.start + 2,
        BYTE_WINDOW_CHANGED.n | BYTE_WINDOW_CHANGED.z,
      );
      if (restoresFlags)
        instructions.splice(
          window.start,
          0,
          // Preserve occurrence metadata while replacing every architectural effect.
          Object.freeze({
            ...window.proof.removed[0]!,
            ...machineInstruction(
              state.input.profile.cpu,
              "ora",
              "immediate",
              { kind: "immediate", value: 0 },
              [],
              window.proof.arithmetic.span,
            ),
          }),
        );
      proofs.push(Object.freeze({ ...window.proof, restoresFlags }));
    }
    return Object.freeze({ ...block, instructions: Object.freeze(instructions) });
  });
  return Object.freeze({
    ...fn,
    blocks: Object.freeze(blocks),
    nativeStoreProofs: Object.freeze([...(fn.nativeStoreProofs ?? []), ...proofs]),
  });
}

/**
 * Remove only exact single-entry reloads from an already shaped function.
 * Physical, raw, firmware and asynchronous observations remain explicit pending
 * obligations. This transformation is an internal candidate template, not an
 * accepted artifact or permission to remove any SFA home.
 * @param fn Original structured machine function with comparison flags already selected.
 * @param owner Actual immutable source function binding.
 * @param cpu Exact selected CPU forms for the proved equality alternative.
 * @param domain Actual execution domain of this machine variant.
 * @param state Optional exact source/native-counter context for adjacent store windows.
 * @returns The unchanged function or a function carrying its conditional observer records.
 */
export function selectByteWindows(
  fn: MachineFunction,
  owner: BindingId,
  cpu: CpuFacts,
  domain: ExecutionDomain = "main",
  state?: FunctionLoweringState,
): MachineFunction {
  if (domain !== "main") return fn;
  if (state !== undefined) fn = selectNativeStoreWindows(fn, state);
  const incoming = new Map(fn.blocks.map((block) => [block.label, [] as MachineBlock[]]));
  const byLabel = new Map(fn.blocks.map((block) => [block.label, block]));
  const safePrefix = byteContinuationQuery(byLabel);
  const addressed = new Set(
    fn.blocks.flatMap((block) =>
      block.instructions.flatMap((instruction) =>
        instruction.operand?.kind === "label" ? [instruction.operand.label] : [],
      ),
    ),
  );
  for (const block of fn.blocks)
    for (const target of successors(block)) incoming.get(target)?.push(block);
  const proofs: ByteAvailabilityProof[] = [];
  const blocks = fn.blocks.map((block) => {
    const predecessors = incoming.get(block.label)!;
    if (predecessors.length !== 1) return block;
    const proof = proveWindow(
      {
        function: owner,
        domain,
        producer: predecessors[0]!,
        consumer: block,
        blocks: byLabel,
        incomingEdges: predecessors.length,
        externallyEntered: fn.blocks[0] === block || addressed.has(block.label),
      },
      safePrefix,
    );
    if (proof === null) return block;
    proofs.push(proof);
    return Object.freeze({ ...block, instructions: Object.freeze(block.instructions.slice(1)) });
  });
  if (proofs.length === 0) return fn;
  const replaced = new Set(proofs.map((proof) => proof.from));
  const converted = blocks.map((block) => {
    if (!replaced.has(block.label)) return block;
    const comparison = valuePreservingByteEquality(block.instructions.at(-1)!, cpu);
    if (comparison === null) throw new Error("Byte window lost its reference equality instruction");
    return Object.freeze({
      ...block,
      instructions: Object.freeze([...block.instructions.slice(0, -1), comparison]),
    });
  });
  return Object.freeze({
    ...fn,
    blocks: Object.freeze(converted),
    byteAvailabilityProofs: Object.freeze([...(fn.byteAvailabilityProofs ?? []), ...proofs]),
  });
}

/** A source-proved complement replacement; physical reads and A/P intervals remain conditional. */
interface ComplementRecipe {
  /** A shared computed complement, or the original byte behind a double complement. */
  readonly kind: "cache" | "original";
  /** Original ordinary source load whose byte supplies this result. */
  readonly load: LoadOperation;
  /** Actual operand load at the replaced site, which can be code-free only without staging. */
  readonly input: LoadOperation;
  /** First complement site, which also gives the cache its stable identity. */
  readonly first: UnaryOperation;
  /** Global sampled binding or private complemented binding being replaced. */
  readonly binding: BindingId;
  /** Entry-dominated cache initialization, absent for an original-field view. */
  readonly preheader: string | null;
  /** An immediate data consumer may load the stable byte without an eager unary reload. */
  readonly defer: boolean;
  /** Earlier left value whose capture can stay in A across a deferred right operand. */
  readonly preservedLeft: string | null;
  /** Counter whose positive-trip premise admits an entry cache, independent of object ranges. */
  readonly admittingCounter: BindingId | null;
}

/** Producer-owned identities prevent stale or edited complement maps from controlling emission. */
const COMPLEMENT_SEAL = Symbol("byte-complement-facts");

/** Finite source complement facts, derived once and shared across construction recipes. */
export interface ByteComplementFacts {
  /** Original checked program, not the rebound global-placement representation. */
  readonly program: WholeProgram;
  /** Exact source function represented by these expressions. */
  readonly function: MachineFunctionSourceFacts["function"];
  /** Selected target identity under which source envelopes were checked. */
  readonly profileId: TargetProfile["id"];
  /** Actual unary operations and their immutable source recipes. */
  readonly replacements: ReadonlyMap<UnaryOperation, ComplementRecipe>;
  /** Private immutable derivation record, not a global registry. */
  readonly [COMPLEMENT_SEAL]: {
    /** Original source facts and fixed-object selection premises. */
    readonly source: MachineFunctionSourceFacts;
    /** Actual target at derivation; relabelling the exposed field cannot change this. */
    readonly profileId: TargetProfile["id"];
    /** Frozen operation/recipe pairs bind the complete map. */
    readonly entries: readonly (readonly [UnaryOperation, ComplementRecipe])[];
  };
}

/** Final logical obligations for one replaced complement site. */
export interface ByteComplementProof {
  /** Exact selected source pair, authenticated by the original sealed replacement map. */
  readonly selection?: readonly [UnaryOperation, ComplementRecipe];
  /** Owning source function and admitted execution domain. */
  readonly function: BindingId;
  /** Only mainline storage/entry contexts are selected by this slice. */
  readonly domain: "main";
  /** Cache sharing or original-value rematerialization. */
  readonly kind: "cache" | "original";
  /** Original source computation and replaced use. */
  readonly producer: SourceSpan;
  /** Actual source operation associated with the selected use. */
  readonly consumer: SourceSpan;
  /** Original global or private binding whose reads change. */
  readonly binding: BindingId;
  /** Actual symbolic byte source after the shared fixed-object recipe. */
  readonly source: ByteWindowAddress;
  /** New predeclared cache, or null when no target storage is added. */
  readonly cacheRequestId: string | null;
  /** A prior value whose obsolete capture home must also be checked in the reference. */
  readonly preservedLeft: string | null;
  /** Conditional induction premises used by source containment/stability. */
  readonly rangeCounters: readonly BindingId[];
  /** No physical/read/alias/asynchronous A/P obligation is discharged by source matching. */
  readonly pendingObservers: true;
}

/** Context-local machine values and entry prefixes; all cache demand is declared before binding. */
export interface ByteComplementRuntime {
  /** Already selected value for each original unary operation. */
  readonly values: ReadonlyMap<UnaryOperation, LoweredValue>;
  /** Non-adjacent original-value uses still sample now to preserve source A/P effects. */
  readonly eager: ReadonlySet<UnaryOperation>;
  /** Pure source operations which emit no code in this representation. */
  readonly noCode: ReadonlySet<SemanticOperation>;
  /** Right operands addressable without destroying a preceding live A. */
  readonly addressValues: ReadonlySet<string>;
  /** Cache setup after the original source preheader operations. */
  readonly prefixes: ReadonlyMap<string, readonly MachineInstruction[]>;
  /** Pending final observer records for actual selected sites. */
  readonly proofs: readonly ByteComplementProof[];
}

/** Admit byte computations only; signed/wider/opaque operands keep ordinary lowering. */
function byteUnary(operation: SemanticOperation): operation is UnaryOperation {
  return (
    operation.kind === "unary" &&
    operation.operator === "~" &&
    operation.type.kind === "scalar" &&
    operation.type.name === "byte"
  );
}

/** Only an immediate data consumer can replace the unary's A/P effects at the same source boundary. */
function deferredComplementUse(use: UnaryOperation, next: SemanticOperation | undefined): boolean {
  return (
    (next?.kind === "binary" &&
      next.type.kind === "scalar" &&
      next.type.name === "byte" &&
      ["&", "|", "^"].includes(next.operator) &&
      next.right === use.result) ||
    (next?.kind === "store" && next.value === use.result) ||
    (next?.kind === "memory-write" && next.width === 1 && next.value === use.result)
  );
}

/**
 * Derive only stable ordinary byte caches and exact double-complement field views.
 * Cache initialization is limited to a positive loop whose preheader is function
 * entry. This needs no general dominator analysis or effectful producer hoisting.
 * @param source Unchanged source facts, fixed-object recipes and admitted loop facts.
 * @param profile Exact selected target/envelope facts.
 * @returns Source-associated immutable replacements; unsupported expressions stay ordinary.
 */
export function deriveByteComplementFacts(
  source: MachineFunctionSourceFacts,
  profile: TargetProfile,
): ByteComplementFacts {
  const blocks = reachableBlocks(source.function.entry, source.function.blocks);
  const definitions = valueDefinitions(blocks);
  const stableGlobalByte = createGlobalByteStabilityQuery(source.function, source.objects, profile);
  const nonlocals = new Set([
    ...source.objects.program.semantic.globals.map((global) => bindingIdentityKey(global.id)),
    ...source.function.parameters.map((parameter) => bindingIdentityKey(parameter.id)),
  ]);
  const replacements = new Map<UnaryOperation, ComplementRecipe>();
  const groups = new Map<
    string,
    {
      use: UnaryOperation;
      load: LoadOperation;
      block: string;
      defer: boolean;
      left: string | null;
    }[]
  >();
  const stores = new Map<string, { value: string; block: string }[]>();
  const addressed = new Set<string>();
  for (const block of blocks)
    for (const operation of block.operations) {
      if (operation.kind === "store") {
        const key = bindingIdentityKey(operation.place.root);
        const list = stores.get(key) ?? [];
        list.push({ value: operation.value, block: block.id });
        stores.set(key, list);
      }
      if (operation.kind === "place-address")
        addressed.add(bindingIdentityKey(operation.place.root));
    }
  for (const block of blocks)
    for (const [index, operation] of block.operations.entries()) {
      if (!byteUnary(operation) || !source.loops.some((loop) => loop.members.has(block.id)))
        continue;
      const load = definitions.get(operation.operand);
      if (
        load?.kind !== "load" ||
        load.place.path.length !== 0 ||
        load.type.kind !== "scalar" ||
        load.type.name !== "byte"
      )
        continue;
      const key = bindingIdentityKey(load.place.root);
      const next = block.operations[index + 1];
      if (stableGlobalByte(load.place.root)) {
        const group = groups.get(key) ?? [];
        group.push({
          use: operation,
          load,
          block: block.id,
          defer: deferredComplementUse(operation, next),
          left:
            next?.kind === "binary" && deferredComplementUse(operation, next) ? next.left : null,
        });
        groups.set(key, group);
        continue;
      }
      const writes = stores.get(key);
      if (
        nonlocals.has(key) ||
        writes?.length !== 1 ||
        writes[0]!.block !== source.function.entry ||
        addressed.has(key)
      )
        continue;
      const first = definitions.get(writes[0]!.value);
      if (first === undefined || !byteUnary(first)) continue;
      const original = definitions.get(first.operand);
      if (
        original?.kind !== "load" ||
        original.type.kind !== "scalar" ||
        original.type.name !== "byte" ||
        original.place.path.length === 0 ||
        original.place.path.some((part) => part.kind !== "field")
      )
        continue;
      const parameter = bindingIdentityKey(original.place.root);
      if (
        !source.storage?.parameters.has(parameter) ||
        !source.objects.stableParameters.has(parameter)
      )
        continue;
      const defer =
        next?.kind === "binary" &&
        next.type.kind === "scalar" &&
        next.type.name === "byte" &&
        ["&", "|", "^"].includes(next.operator) &&
        next.right === operation.result;
      replacements.set(
        operation,
        Object.freeze({
          kind: "original",
          load: original,
          input: load,
          first,
          binding: load.place.root,
          preheader: null,
          defer,
          preservedLeft: defer && next?.kind === "binary" ? next.left : null,
          admittingCounter: null,
        }),
      );
    }
  for (const group of groups.values()) {
    const first = group[0]!;
    const loop = source.loops.find(
      (value) =>
        value.body.id === first.block &&
        value.preheader.id === source.function.entry &&
        value.tripDomain.minimum > 0,
    );
    if (group.length < 2 || loop === undefined) continue;
    for (const site of group)
      replacements.set(
        site.use,
        Object.freeze({
          kind: "cache",
          load: site.load,
          input: site.load,
          first: first.use,
          binding: site.load.place.root,
          preheader: loop.preheader.id,
          defer: site.defer,
          preservedLeft: site.left,
          admittingCounter: loop.counter,
        }),
      );
  }
  return Object.freeze({
    program: source.objects.program,
    function: source.function,
    profileId: profile.id,
    replacements,
    [COMPLEMENT_SEAL]: Object.freeze({
      source,
      profileId: profile.id,
      entries: Object.freeze([...replacements].map((entry) => Object.freeze(entry))),
    }),
  });
}

/** Check exact immutable source/recipe identities without repeating source analysis. */
export function validByteComplementFacts(
  facts: ByteComplementFacts,
  source: MachineFunctionSourceFacts,
  profileId: TargetProfile["id"],
): boolean {
  const seal = facts[COMPLEMENT_SEAL];
  return (
    seal !== undefined &&
    facts.program === source.objects.program &&
    facts.function === source.function &&
    facts.profileId === profileId &&
    seal.profileId === profileId &&
    seal.source.objects === source.objects &&
    seal.source.function === source.function &&
    seal.source.loops.length === source.loops.length &&
    seal.source.loops.every((loop, index) => source.loops[index] === loop) &&
    facts.replacements.size === seal.entries.length &&
    seal.entries.every(
      ([operation, recipe]) =>
        facts.replacements.get(operation) === recipe &&
        (recipe.kind !== "original" ||
          source.storage?.parameters.get(bindingIdentityKey(recipe.load.place.root)) ===
            source.objects.parameters.get(bindingIdentityKey(recipe.load.place.root))),
    )
  );
}
