import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import type { SemanticFunction, SemanticGlobal, SemanticOperation } from "./operations.js";
import type { WholeProgram } from "./whole-program.js";
import type { InterruptExecutionContext } from "./interrupt-contexts.js";
import { interruptDepthAt } from "./interrupt-contexts.js";
import { interruptArgumentInputs, interruptArgumentFactsKey } from "./interrupt-argument-facts.js";
import { extendsActiveInterruptChain } from "./interrupt-context-walk.js";
import { interruptLinkObservers, interruptVectorStateKey } from "./interrupt-context-facts.js";
import type {
  InterruptContextInvocation,
  LinkCapture,
  SelectedEntry,
  VectorState,
} from "./interrupt-context-facts.js";

/** Existing invocation inputs, separate from the monotonically discovered return/call facts. */
type InvocationInput = Pick<
  InterruptContextInvocation,
  "body" | "input" | "context" | "protectedReaders" | "activeEntry" | "ancestors" | "arguments"
>;

/** Request one actual ordered call or selected interrupt entry in the caller's worklist. */
export type InterruptContextRequester = (
  body: SemanticFunction | SemanticGlobal,
  input: VectorState,
  context: InterruptExecutionContext,
  protectedReaders: ReadonlyMap<string, LinkCapture>,
  activeEntry?: SelectedEntry,
  ancestors?: ReadonlyMap<string, SelectedEntry>,
  arguments_?: readonly (bigint | undefined)[],
) => InterruptContextInvocation;

/**
 * Memoize the existing finite invocation relation. Trace paths do not distinguish
 * states; actual predecessor relations and copied scalar inputs do. This helper
 * neither traverses source control flow nor schedules a second proof engine.
 */
export function requestInterruptContext(
  input: InvocationInput,
  program: WholeProgram,
  invocations: Map<string, InterruptContextInvocation>,
  contexts: Map<string, InterruptExecutionContext[]>,
  schedule: (invocation: InterruptContextInvocation) => void,
): InterruptContextInvocation {
  const owner = bindingIdentityKey(input.body.id);
  // Return effects belong to this execution, not to writes before its call.
  const state =
    input.input.cia2 === undefined ? input.input : { ...input.input, writesHomes: false };
  const key = JSON.stringify([
    owner,
    input.context,
    interruptVectorStateKey(
      state,
      interruptLinkObservers(state, input.protectedReaders, input.activeEntry, program),
    ),
    [...input.protectedReaders].map(([slot, capture]) => [slot, capture.entry?.id ?? null]).sort(),
    input.activeEntry?.id ?? null,
    [...input.ancestors].map(([handler, entry]) => [handler, entry.id]).sort(),
    interruptArgumentFactsKey(interruptArgumentInputs(input.body, input.arguments)),
  ]);
  const previous = invocations.get(key);
  if (previous !== undefined) return previous;
  const invocation: InterruptContextInvocation = {
    ...input,
    input: state,
    exits: new Map(),
    callers: new Set(),
    reached: new Map(),
    calls: new Map(),
    restores: new Map(),
  };
  invocations.set(key, invocation);
  const selected = contexts.get(owner) ?? [];
  if (!selected.some((entry) => JSON.stringify(entry) === JSON.stringify(input.context))) {
    selected.push(input.context);
    contexts.set(owner, selected);
  }
  schedule(invocation);
  return invocation;
}

/** Enter one actual installed/chain target, protecting the executions it suspends. */
export function enterInterruptContext(
  selected: SelectedEntry,
  state: VectorState,
  node: InterruptContextInvocation,
  chain: boolean,
  program: WholeProgram,
  bodies: ReadonlyMap<string, SemanticFunction | SemanticGlobal>,
  diagnostics: ProjectDiagnostic[],
  request: InterruptContextRequester,
): InterruptContextInvocation | null {
  if (extendsActiveInterruptChain(selected, state, node.ancestors, program)) {
    diagnostics.push(
      projectDiagnostic(
        "E10245",
        `Execution path '${selected.route.sink.source}' has unbounded private-storage overlap, disallowed unbounded stack use, or unproved generated reentrancy`,
        selected.route.installation.span,
        null,
        state.path.map((span) => ({ span, message: "Generated continuation extends here" })),
      ),
    );
    return null;
  }
  const body = bodies.get(bindingIdentityKey(selected.route.handler));
  if (body === undefined) throw new Error("Selected interrupt body is missing");
  const called = request(
    body,
    { ...state, owners: { irq: [], nmi: [] }, enabled: false, eligible: false, saved: [] },
    selected.context,
    interruptLinkObservers(
      state,
      node.protectedReaders,
      chain ? undefined : node.activeEntry,
      program,
    ),
    selected,
    new Map([...node.ancestors, [selected.id, selected]]),
  );
  called.callers.add(node);
  return called;
}

/** Request each already-closed direct/finite-target ordinary edge with its actual arguments. */
export function requestInterruptCalls(
  operation: Extract<SemanticOperation, { readonly kind: "call" | "indirect-call" }>,
  state: VectorState,
  node: InterruptContextInvocation,
  program: WholeProgram,
  bodies: ReadonlyMap<string, SemanticFunction | SemanticGlobal>,
  request: InterruptContextRequester,
  arguments_: readonly (bigint | undefined)[],
): readonly InterruptContextInvocation[] {
  const targets =
    operation.kind === "call"
      ? [operation.callee]
      : (program.indirectTargets?.get(operation) ?? []);
  const calls: InterruptContextInvocation[] = [];
  for (const target of targets) {
    const body = bodies.get(bindingIdentityKey(target));
    if (body === undefined) continue;
    const called = request(
      body,
      { ...state, eligible: state.enabled, path: [...state.path, operation.span] },
      interruptDepthAt(node.context, operation, program),
      node.protectedReaders,
      node.activeEntry,
      node.ancestors,
      arguments_,
    );
    called.callers.add(node);
    const choices = node.calls.get(operation) ?? new Set<InterruptContextInvocation>();
    choices.add(called);
    node.calls.set(operation, choices);
    calls.push(called);
  }
  return calls;
}
