import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { ExecutionDomain } from "../semantic/interrupt-domains.js";
import { interruptDepthAt } from "../semantic/interrupt-contexts.js";
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
function domainOwner(key: string, domain: ExecutionDomain): string {
  return `${key}${domain === "main" ? "" : `@${domain}`}`;
}

/** Expose provisional unsuffixed names to the existing single-body selector. */
export function provisionalDomainAliases(
  placement: StoragePlacement,
  program: WholeProgram,
): StoragePlacement {
  const existing = new Set(placement.homes.map(({ requestId }) => requestId));
  const aliases: StorageHome[] = [];
  for (const entry of program.executionDomains ?? []) {
    const key = bindingIdentityKey(entry.function);
    for (const home of placement.homes) {
      for (const domain of ["irq", "nmi"] as const) {
        const prefix = `${key}@${domain}:`;
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
): string {
  for (const entry of program.executionDomains ?? []) {
    if (!entry.domains.includes(domain)) continue;
    const key = bindingIdentityKey(entry.function);
    for (const prefix of [key, `machine:${key}`]) {
      for (const current of [prefix, `${prefix}@irq`, `${prefix}@nmi`]) {
        if (requestId.startsWith(`${current}:`)) {
          return `${domainOwner(prefix, domain)}:${requestId.slice(current.length + 1)}`;
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
): StorageRequest {
  return Object.freeze({
    ...request,
    id: domainRequestId(request.id, domain, program),
    domain,
  });
}

/** Pick the one fixed code variant admitted by a source function's entry context. */
export function contextFunctionLabel(
  label: string,
  context: InterruptExecutionContext,
  contexts: InterruptExecutionContexts,
  program: WholeProgram,
): string {
  for (const fn of program.semantic.functions) {
    const key = bindingIdentityKey(fn.id);
    if (label !== `fn.${key}`) continue;
    if (fn.entryKind === "interrupt") return label;
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

/** Recover the source call behind a selected JSR so its callee gets the right vector depth. */
function calleeContext(
  instruction: MachineInstruction,
  label: string,
  context: InterruptExecutionContext,
  program: WholeProgram,
): InterruptExecutionContext {
  if (instruction.opcode !== "jsr" || instruction.source === null) return context;
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
          return interruptDepthAt(context, operation, program);
        }
      }
    }
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
): MachineOperand | null {
  if (operand === null) return null;
  if (operand.kind === "storage" || operand.kind === "indirect-y") {
    return Object.freeze({
      ...operand,
      requestId: domainRequestId(operand.requestId, context.domain, program),
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
        calleeContext(instruction, operand.label, context, program),
        contexts,
        program,
      ),
    });
  }
  return operand;
}

/** Retain memory-effect identity when a private home changes address. */
function domainAddress(
  address: MachineMemoryAddress,
  domain: ExecutionDomain,
  program: WholeProgram,
): MachineMemoryAddress {
  if (address.kind === "storage" || address.kind === "indirect-y") {
    return Object.freeze({
      ...address,
      requestId: domainRequestId(address.requestId, domain, program),
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
): MachineInstruction {
  return Object.freeze({
    ...instruction,
    operand: domainOperand(instruction.operand, instruction, context, contexts, program),
    memory: Object.freeze(
      instruction.memory.map((effect) =>
        Object.freeze({
          ...effect,
          address: domainAddress(effect.address, context.domain, program),
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
): MachineFunction {
  const selectedId = contextFunctionLabel(body.id, context, contexts, program);
  const suffix = selectedId.slice(body.id.length);
  const labels = new Map(
    body.blocks.map((block) => [block.label, `${block.label}${suffix}`] as const),
  );
  const target = (label: string): string =>
    labels.get(label) ?? contextFunctionLabel(label, context, contexts, program);
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
          const selected = domainInstruction(instruction, context, contexts, program);
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
