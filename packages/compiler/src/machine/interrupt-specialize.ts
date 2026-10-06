import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { ExecutionDomain } from "../semantic/interrupt-domains.js";
import { interruptDepthAt } from "../semantic/interrupt-contexts.js";
import { functionEntryContext } from "../semantic/interrupt-context-facts.js";
import { reachableBlocks } from "../semantic/value-lifetimes.js";
import type {
  InterruptExecutionContext,
  InterruptExecutionContexts,
} from "../semantic/interrupt-contexts.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import type { StorageHome, StoragePlacement, StorageRequest } from "../storage/storage-types.js";
import type {
  MachineBlock,
  MachineFunction,
  MachineInstruction,
  MachineMemoryAddress,
  MachineOperand,
  MachineTerminator,
} from "./machine-types.js";

/** Use the existing mainline spelling, but distinguish fixed interrupt homes. */
function domainOwner(key: string, domain: ExecutionDomain, activationRoot?: string): string {
  return `${key}${domain === "main" ? "" : `@${domain}`}${activationRoot === undefined ? "" : `@${activationRoot}`}`;
}

/** Expose provisional unsuffixed names to the existing single-body selector. */
export function provisionalDomainAliases(
  placement: StoragePlacement,
  program: WholeProgram,
  activationRoot?: string,
): StoragePlacement {
  const existing = new Set(placement.homes.map(({ requestId }) => requestId));
  const aliases: StorageHome[] = [];
  const domains: readonly ExecutionDomain[] =
    activationRoot === undefined ? ["irq", "nmi"] : ["main", "irq", "nmi"];
  const hasNmiContexts =
    program.interruptRoutes?.some(({ sink }) => sink.domain === "nmi") === true;
  for (const entry of program.executionDomains ?? []) {
    const key = bindingIdentityKey(entry.function);
    for (const home of placement.homes) {
      for (const domain of domains) {
        const prefix = `${domainOwner(key, domain, domain === "irq" || hasNmiContexts ? activationRoot : undefined)}:`;
        if (!home.requestId.startsWith(prefix)) continue;
        const alias = `${key}:${home.requestId.slice(prefix.length)}`;
        if (existing.has(alias)) continue;
        existing.add(alias);
        aliases.push(Object.freeze({ ...home, requestId: alias }));
      }
    }
  }
  return Object.freeze({ homes: Object.freeze([...placement.homes, ...aliases]) });
}

/** Replace an invocation-private home with its fixed execution-domain home. */
export function domainRequestId(
  requestId: string,
  domain: ExecutionDomain,
  program: WholeProgram,
  activationRoot?: string,
): string {
  for (const entry of program.executionDomains ?? []) {
    if (activationRoot === undefined && !entry.domains.includes(domain)) continue;
    const key = bindingIdentityKey(entry.function);
    for (const prefix of [key, `machine:${key}`]) {
      for (const current of [prefix, `${prefix}@irq`, `${prefix}@nmi`]) {
        if (requestId.startsWith(`${current}:`)) {
          return `${domainOwner(prefix, domain, activationRoot)}:${requestId.slice(current.length + 1)}`;
        }
      }
    }
  }
  return requestId;
}

/** A machine-discovered request is separately closed for each live domain. */
export function domainStorageRequest(
  request: StorageRequest,
  domain: ExecutionDomain,
  program: WholeProgram,
  activationRoot?: string,
): StorageRequest {
  return Object.freeze({
    ...request,
    id: domainRequestId(request.id, domain, program, activationRoot),
    domain,
    ...(activationRoot === undefined ? {} : { activationRoot }),
  });
}

/** Pick the one fixed code variant admitted by a source function's entry context. */
export function contextFunctionLabel(
  label: string,
  context: InterruptExecutionContext,
  contexts: InterruptExecutionContexts,
  program: WholeProgram,
  rootAware = false,
): string {
  for (const fn of program.semantic.functions) {
    const key = bindingIdentityKey(fn.id);
    if (label !== `fn.${key}`) continue;
    if (fn.entryKind === "interrupt") return label;
    // An ordinary terminal leaf with only constants and unconditional edges
    // has no fixed homes, calls, links or entry/exit duties to specialize.
    // Share only that source function's canonical body; different declarations
    // still have different labels, even when both are identical empty loops.
    if (
      fn.parameters.length === 0 &&
      fn.result.kind === "scalar" &&
      fn.result.name === "void" &&
      program.interruptOwnership?.returningBodies?.get(key) === false &&
      // Finite function-word consumers keep their existing canonical/context
      // selection. This narrow sharing rule covers closed direct leaf calls,
      // without also changing the independent indirect-call dispatch strategy.
      ![...(program.indirectTargets?.values() ?? [])].some((targets) =>
        targets.some((target) => bindingIdentityKey(target) === key),
      ) &&
      reachableBlocks(fn.entry, fn.blocks).every(
        (block) =>
          block.terminator.kind === "jump" &&
          block.operations.every((operation) => operation.kind === "constant"),
      )
    )
      return label;
    context = functionEntryContext(key, context, contexts, rootAware);
    if (rootAware && context.activationRoot !== undefined) {
      const root = Buffer.from(context.activationRoot).toString("hex");
      const chosen = context;
      // One retained mainline ABI owns the ordinary source label. Additional
      // fixed-word variants still specialize consistently with their callers.
      const firstMain = (contexts.get(key) ?? []).find((entry) => entry.domain === "main");
      if (
        context.domain === "main" &&
        firstMain !== undefined &&
        firstMain.activationRoot === chosen.activationRoot &&
        firstMain.localIrqDepth === chosen.localIrqDepth &&
        firstMain.localNmiDepth === chosen.localNmiDepth
      )
        return label;
      // The paired local depths distinguish both sinks in a mixed route. Legacy
      // IRQ-only contexts lack the NMI field and retain their original label.
      const depth =
        chosen.localNmiDepth === undefined
          ? `${chosen.localIrqDepth ?? 0}`
          : `${chosen.localIrqDepth ?? 0}.${chosen.localNmiDepth}`;
      return `${label}.${context.domain}.root${root}.depth${depth}`;
    }
    const sameDomain = (contexts.get(key) ?? []).filter((entry) => entry.domain === context.domain);
    if (
      context.domain === "main" &&
      (sameDomain.length <= 1 ||
        (sameDomain[0]?.irq === context.irq && sameDomain[0]?.nmi === context.nmi))
    )
      return label;
    if (sameDomain.length <= 1) return `${label}.${context.domain}`;
    return `${label}.${context.domain}.depth${context.irq}.${context.nmi}`;
  }
  return label;
}

/** Recover a call's entry depths for both its JSR and its incoming-home writes. */
function calleeContext(
  instruction: MachineInstruction,
  label: string,
  context: InterruptExecutionContext,
  program: WholeProgram,
  callContexts: Map<string, InterruptExecutionContext>,
): InterruptExecutionContext {
  if (instruction.source === null) return context;
  const cacheKey = JSON.stringify([label, instruction.source]);
  const cached = callContexts.get(cacheKey);
  if (cached !== undefined) return cached;
  for (const owner of [...program.semantic.functions, ...program.semantic.globals]) {
    for (const block of owner.blocks) {
      for (const operation of block.operations) {
        if (operation.kind !== "call" && operation.kind !== "indirect-call") continue;
        if (
          operation.span.sourceId !== instruction.source.sourceId ||
          operation.span.start !== instruction.source.start ||
          operation.span.end !== instruction.source.end
        )
          continue;
        const targets =
          operation.kind === "call"
            ? [operation.callee]
            : (program.indirectTargets?.get(operation) ?? []);
        if (targets.some((target) => label === `fn.${bindingIdentityKey(target)}`)) {
          const selected = interruptDepthAt(context, operation, program);
          callContexts.set(cacheKey, selected);
          return selected;
        }
      }
    }
  }
  callContexts.set(cacheKey, context);
  return context;
}

/**
 * Only a target-owned home uses the callee ABI. Caller argument staging and
 * aggregate result storage keep the caller's descriptor even at the call span.
 */
function privateHomeContext(
  requestId: string,
  instruction: MachineInstruction,
  context: InterruptExecutionContext,
  contexts: InterruptExecutionContexts,
  program: WholeProgram,
  rootAware: boolean,
  callContexts: Map<string, InterruptExecutionContext>,
): InterruptExecutionContext {
  for (const fn of program.semantic.functions) {
    const key = bindingIdentityKey(fn.id);
    if (
      ![key, `machine:${key}`].some((prefix) =>
        [prefix, `${prefix}@irq`, `${prefix}@nmi`].some((owner) =>
          requestId.startsWith(`${owner}:`),
        ),
      )
    )
      continue;
    const at = calleeContext(instruction, `fn.${key}`, context, program, callContexts);
    return at === context ? context : functionEntryContext(key, at, contexts, rootAware);
  }
  return context;
}

/** Rewrite the few operand identities that depend on one domain's fixed homes. */
function domainOperand(
  operand: MachineOperand | null,
  instruction: MachineInstruction,
  context: InterruptExecutionContext,
  contexts: InterruptExecutionContexts,
  program: WholeProgram,
  rootAware: boolean,
  callContexts: Map<string, InterruptExecutionContext>,
): MachineOperand | null {
  if (operand === null) return null;
  if (operand.kind === "storage" || operand.kind === "indirect-y") {
    const selected = privateHomeContext(
      operand.requestId,
      instruction,
      context,
      contexts,
      program,
      rootAware,
      callContexts,
    );
    return Object.freeze({
      ...operand,
      requestId: domainRequestId(
        operand.requestId,
        selected.domain,
        program,
        rootAware ? selected.activationRoot : undefined,
      ),
    });
  }
  if (operand.kind === "label") {
    // A function value is a stable source identity. Only a proved direct call
    // selects the context-specific body; comparisons and address materialization
    // must keep comparing the same original two-byte value.
    if (instruction.opcode !== "jsr") return operand;
    return Object.freeze({
      ...operand,
      label: contextFunctionLabel(
        operand.label,
        calleeContext(instruction, operand.label, context, program, callContexts),
        contexts,
        program,
        rootAware,
      ),
    });
  }
  return operand;
}

/** Retain memory-effect identity when a private home changes address. */
function domainAddress(
  address: MachineMemoryAddress,
  instruction: MachineInstruction,
  context: InterruptExecutionContext,
  contexts: InterruptExecutionContexts,
  program: WholeProgram,
  rootAware: boolean,
  callContexts: Map<string, InterruptExecutionContext>,
): MachineMemoryAddress {
  if (address.kind === "storage" || address.kind === "indirect-y") {
    const selected = privateHomeContext(
      address.requestId,
      instruction,
      context,
      contexts,
      program,
      rootAware,
      callContexts,
    );
    return Object.freeze({
      ...address,
      requestId: domainRequestId(
        address.requestId,
        selected.domain,
        program,
        rootAware ? selected.activationRoot : undefined,
      ),
    });
  }
  return address;
}

/** Specialize one selected instruction without changing opcode, effects or cost. */
function domainInstruction(
  instruction: MachineInstruction,
  context: InterruptExecutionContext,
  contexts: InterruptExecutionContexts,
  program: WholeProgram,
  rootAware: boolean,
  callContexts: Map<string, InterruptExecutionContext>,
): MachineInstruction {
  return Object.freeze({
    ...instruction,
    operand: domainOperand(
      instruction.operand,
      instruction,
      context,
      contexts,
      program,
      rootAware,
      callContexts,
    ),
    memory: Object.freeze(
      instruction.memory.map((effect) =>
        Object.freeze({
          ...effect,
          address: domainAddress(
            effect.address,
            instruction,
            context,
            contexts,
            program,
            rootAware,
            callContexts,
          ),
        }),
      ),
    ),
  });
}

/** Duplicate only fixed-home code; no runtime switch or function-state copy is emitted. */
export function domainMachineFunction(
  body: MachineFunction,
  context: InterruptExecutionContext,
  contexts: InterruptExecutionContexts,
  program: WholeProgram,
  rootAware = false,
): MachineFunction {
  const selectedId = contextFunctionLabel(body.id, context, contexts, program, rootAware);
  const suffix = selectedId.slice(body.id.length);
  const labels = new Map(
    body.blocks.map((block) => [block.label, `${block.label}${suffix}`] as const),
  );
  // Argument setup repeats one source call span across many instructions and
  // effects. Recover that call once per target/body, not once per byte access.
  const callContexts = new Map<string, InterruptExecutionContext>();
  const target = (label: string): string =>
    labels.get(label) ?? contextFunctionLabel(label, context, contexts, program, rootAware);
  const blocks: MachineBlock[] = body.blocks.map((block) => {
    const terminal = block.terminator;
    const terminator: MachineTerminator =
      terminal.kind === "jump" || terminal.kind === "fallthrough"
        ? Object.freeze({ ...terminal, target: target(terminal.target) })
        : terminal.kind === "branch"
          ? Object.freeze({
              ...terminal,
              target: target(terminal.target),
              fallthrough: target(terminal.fallthrough),
            })
          : terminal.kind === "long-branch"
            ? Object.freeze({
                ...terminal,
                fallthrough: target(terminal.fallthrough),
                jump: Object.freeze({ ...terminal.jump, target: target(terminal.jump.target) }),
              })
            : terminal;
    return Object.freeze({
      ...block,
      label: labels.get(block.label)!,
      instructions: Object.freeze(
        block.instructions.map((instruction) => {
          const selected = domainInstruction(
            instruction,
            context,
            contexts,
            program,
            rootAware,
            callContexts,
          );
          return selected.operand?.kind === "label" && labels.has(selected.operand.label)
            ? Object.freeze({
                ...selected,
                operand: Object.freeze({
                  ...selected.operand,
                  label: labels.get(selected.operand.label)!,
                }),
              })
            : selected;
        }),
      ),
      terminator,
    });
  });
  return Object.freeze({
    ...body,
    id: selectedId,
    blocks: Object.freeze(blocks),
  });
}
