import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import {
  interruptDepthAt,
  interruptExecutionContexts,
  interruptRouteDepths,
  irqPredecessorSlot,
} from "../semantic/interrupt-contexts.js";
import type { InterruptExecutionContext } from "../semantic/interrupt-contexts.js";
import {
  interruptEntrySelection,
  interruptExecutedBlocks,
  interruptRetainedBlocks,
  interruptMaterializations,
  interruptCodeContexts,
  interruptExecutionKey,
} from "../semantic/interrupt-context-facts.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import type { SemanticOperation, SemanticTerminator } from "../semantic/operations.js";
import type { HelperCallDemand, StorageRequest } from "../storage/storage-types.js";
import { storageInventoryHash } from "../storage/closure.js";
import { hasHandlerSideIrqInstall, inventoryStorage } from "../storage/inventory.js";
import {
  createC64Startup,
  createC64StartupStateData,
  type C64StartupInitializer,
} from "../layout/startup.js";
import { machineInstruction } from "./lower-control.js";
import { c64InterruptEntryLabel, createC64InterruptEntry, RAW_HANDLER_ENTRY } from "./lower-c64.js";
import { createC64ReferenceInterruptEntry } from "./lower-c64-interrupt.js";
import {
  domainMachineFunction,
  contextFunctionLabel,
  domainRequestId,
  domainStorageRequest,
  provisionalDomainAliases,
} from "./interrupt-specialize.js";
import type {
  MachineDataObject,
  MachineFunction,
  MachineInstruction,
  MachineLoweringInput,
  MachineLoweringResult,
  MachineMemoryEffect,
} from "./machine-types.js";
import { loweringFailure, isLoweringFailure, typeBytes, bindingLabel } from "./lower-state.js";
import { lowerFunction } from "./lower-function.js";
import { createC64NmiEntries } from "./nmi-entry.js";
import type { PendingC64NmiEntry } from "./nmi-entry.js";
export * from "./lower-state.js";

/** Return the machine data objects owned by globals and reachable assets. */
function lowerData(
  program: WholeProgram,
  generatedData: ReadonlyMap<string, MachineDataObject>,
  functions: readonly MachineFunction[],
  startup: MachineFunction,
  bindingNames?: ReadonlyMap<string, string>,
): readonly MachineDataObject[] {
  const spriteAssets = new Set(
    [...functions, startup].flatMap((fn) =>
      fn.blocks.flatMap((block) =>
        block.instructions.flatMap((instruction) =>
          instruction.operand?.kind === "label" &&
          instruction.operand.transform === "vic-sprite-block"
            ? [instruction.operand.label]
            : [],
        ),
      ),
    ),
  );
  const globals = program.semantic.globals
    .filter(
      (global) =>
        !(global.storage === "constant" && global.type.kind === "scalar" && !global.placement),
    )
    .map((global) => {
      const sourceName = bindingNames?.get(bindingIdentityKey(global.id));
      const bytes = typeBytes(global.type);
      const encoded = global.initialBytes;
      if (encoded !== null && encoded.length !== bytes) {
        throw loweringFailure("Global initial bytes do not match the declared type", global.source);
      }
      return Object.freeze({
        id: bindingLabel("global", global.id),
        ...(sourceName === undefined ? {} : { sourceName }),
        kind:
          encoded === null
            ? ("bss" as const)
            : global.storage === "constant"
              ? ("immutable" as const)
              : ("global" as const),
        alignment: 1,
        bytes: encoded ?? Object.freeze(new Array<number>(bytes).fill(0)),
        ...(global.placement ? { placement: global.placement } : {}),
        ...(global.zeropage ? { zeropage: true } : {}),
      });
    });
  const reachable = new Set(program.reachableAssets);
  const assets = program.semantic.assets
    .filter(({ id }) => reachable.has(id))
    .map((asset) => {
      const vicSpriteBlocks = spriteAssets.has(`asset.${asset.id}`);
      return Object.freeze({
        id: `asset.${asset.id}`,
        kind: "asset" as const,
        assetId: asset.id,
        sourceName: asset.sourcePath,
        vicSpriteBlocks,
        alignment: vicSpriteBlocks ? 64 : 1,
        bytes: asset.bytes,
        ...(asset.placement === undefined ? {} : { placement: asset.placement }),
      });
    });
  const generated = [...generatedData.values()].sort((left, right) =>
    Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
  );
  return Object.freeze([...globals, ...assets, ...generated, createC64StartupStateData()]);
}

/** Lower a side-effect-free constant module initializer to inline runtime stores. */
function lowerConstantInitializer(
  global: WholeProgram["semantic"]["globals"][number],
  input: MachineLoweringInput,
  accumulator: number | null,
): { readonly instructions: readonly MachineInstruction[]; readonly accumulator: number | null } {
  const bytes = global.runtimeInitialBytes;
  if (bytes === null || global.entry === null || bytes.length !== typeBytes(global.type)) {
    throw loweringFailure(
      "Constant runtime initializer bytes do not match the global",
      global.source,
    );
  }
  const target = bindingLabel("global", global.id);
  const instructions: MachineInstruction[] = [];
  let currentAccumulator = accumulator;
  for (const [offset, value] of bytes.entries()) {
    if (value !== currentAccumulator) {
      instructions.push(
        machineInstruction(
          input.profile.cpu,
          "lda",
          "immediate",
          Object.freeze({ kind: "immediate", value }),
          [],
          global.source,
        ),
      );
      currentAccumulator = value;
    }
    const memory = Object.freeze([
      Object.freeze({
        kind: "write" as const,
        address: Object.freeze({ kind: "symbolic" as const, label: target, offset }),
        width: 1 as const,
        volatile: false,
        order: 0,
      }),
    ]) satisfies readonly MachineMemoryEffect[];
    instructions.push(
      machineInstruction(
        input.profile.cpu,
        "sta",
        "absolute",
        Object.freeze({ kind: "label", label: target, offset }),
        memory,
        global.source,
      ),
    );
  }
  return Object.freeze({
    instructions: Object.freeze(instructions),
    accumulator: currentAccumulator,
  });
}

/**
 * Lower one closed semantic program directly to documented NMOS machine operations.
 * @param input Closed program, provisional SFA placement and exact selected profile.
 * @returns Structured machine program plus its finite late-storage binder.
 */
export function lowerMachineProgram(input: MachineLoweringInput): MachineLoweringResult {
  const requests: StorageRequest[] = [];
  const generatedData = new Map<string, MachineDataObject>();
  const helperUses: {
    readonly id: string;
    readonly caller: BindingId;
    readonly requestIds: readonly string[];
    readonly source: SourceSpan;
    readonly activationRoot?: string;
  }[] = [];
  const warnings: ProjectDiagnostic[] = [];
  const instructionSites = new Set<SemanticOperation | SemanticTerminator>();
  try {
    const functionsByKey = new Map(
      input.program.semantic.functions.map((fn) => [bindingIdentityKey(fn.id), fn] as const),
    );
    const executedContexts = interruptExecutionContexts(input.program);
    const retained = interruptMaterializations(input.program);
    const contexts = interruptCodeContexts(executedContexts, retained.contexts);
    const hasNmiRoutes = input.program.interruptRoutes?.some(({ sink }) => sink.domain === "nmi");
    const sharedProof = hasNmiRoutes ? input.program.interruptContextAnalysis : undefined;
    if (hasNmiRoutes && (sharedProof === undefined || sharedProof.diagnostics.length > 0))
      throw loweringFailure("Interrupt wrappers require complete installation-link proof", null);
    const rootAware = hasNmiRoutes || hasHandlerSideIrqInstall(input.program, contexts);
    const rawDependencies = retained.raw;
    const loweringInput = Object.freeze({
      ...input,
      retainedInterrupts: retained,
      placement: provisionalDomainAliases(input.placement, input.program),
    });
    const routeDepths = interruptRouteDepths(input.program, contexts);
    const routeSlots = new Map<SemanticOperation, Set<string>>();
    if (rootAware && sharedProof === undefined) {
      for (const route of input.program.interruptRoutes ?? []) {
        if (route.sink.domain !== "irq") continue;
        const owner = input.program.semantic.functions.find((fn) =>
          fn.blocks.some((block) => block.operations.includes(route.installation)),
        );
        const entries =
          owner === undefined
            ? input.program.semantic.globals.flatMap((global) => {
                if (!global.blocks.some((block) => block.operations.includes(route.installation)))
                  return [];
                const depth = input.program.interruptOwnership?.initializerEntryDepths.get(
                  bindingIdentityKey(global.id),
                );
                return [{ domain: "main" as const, irq: depth?.irq ?? 0, nmi: depth?.nmi ?? 0 }];
              })
            : (contexts.get(bindingIdentityKey(owner.id)) ?? []);
        const slots = routeSlots.get(route.installation) ?? new Set<string>();
        for (const entry of entries) {
          slots.add(irqPredecessorSlot(interruptDepthAt(entry, route.installation, input.program)));
        }
        routeSlots.set(route.installation, slots);
      }
    }
    const machineFunctions: MachineFunction[] = [];
    const pendingNmiEntries: PendingC64NmiEntry[] = [];
    const rawHandlerBodies = new Map<string, MachineFunction>();
    for (const functionId of input.program.reachableFunctions) {
      const semantic = functionsByKey.get(bindingIdentityKey(functionId));
      if (semantic === undefined) {
        throw loweringFailure("Reachable semantic function is absent", functionId.span);
      }
      const id = bindingLabel("fn", semantic.id);
      const key = bindingIdentityKey(semantic.id);
      const executed: readonly InterruptExecutionContext[] =
        executedContexts.get(key) ??
        (sharedProof === undefined
          ? [Object.freeze({ domain: "main" as const, irq: 0, nmi: 0 })]
          : []);
      // Raw emission is a retained dependency, not a fabricated invocation.
      // It owns the ordinary source identity and ABI homes. An observed
      // mainline context for that identity must keep its real link choices.
      const raw = rawDependencies.has(key);
      const retainedKeys = new Set(
        (retained.contexts.get(key) ?? []).map((context) => interruptExecutionKey(key, context)),
      );
      const variants = contexts.get(key) ?? executed;
      for (const context of variants) {
        const retainedBody = retainedKeys.has(interruptExecutionKey(key, context));
        const rawBody = raw && retainedBody && context.domain === "main";
        const blocks =
          sharedProof === undefined
            ? semantic.blocks
            : retainedBody
              ? interruptRetainedBlocks(semantic, input.program)
              : interruptExecutedBlocks(
                  semantic,
                  executed.filter((entry) =>
                    semantic.entryKind === "interrupt"
                      ? entry.activationRoot === context.activationRoot
                      : contextFunctionLabel(id, entry, contexts, input.program, rootAware) ===
                        contextFunctionLabel(id, context, contexts, input.program, rootAware),
                  ),
                  sharedProof,
                );
        if (blocks.length === 0) continue;
        const contextInput =
          rootAware && context.activationRoot !== undefined
            ? Object.freeze({
                ...input,
                retainedInterrupts: retained,
                placement: provisionalDomainAliases(
                  input.placement,
                  input.program,
                  context.activationRoot,
                ),
              })
            : loweringInput;
        const discovered: StorageRequest[] = [];
        const selectedHelpers: typeof helperUses = [];
        const body = lowerFunction(
          id,
          semantic.id,
          blocks,
          contextInput,
          discovered,
          generatedData,
          selectedHelpers,
          warnings,
          bindingIdentityKey(semantic.id) === bindingIdentityKey(input.program.semantic.main),
          context,
          instructionSites,
        );
        const lowered = semantic.placement
          ? Object.freeze({ ...body, placement: semantic.placement })
          : body;
        requests.push(
          ...discovered.map((request) =>
            domainStorageRequest(
              request,
              context.domain,
              input.program,
              rootAware ? context.activationRoot : undefined,
            ),
          ),
        );
        helperUses.push(
          ...selectedHelpers.map((use) =>
            Object.freeze({
              ...use,
              id:
                rootAware && context.activationRoot !== undefined
                  ? `${use.id}.${context.domain}.root${Buffer.from(context.activationRoot).toString("hex")}.depth${context.localIrqDepth ?? 0}${context.localNmiDepth === undefined ? "" : `.${context.localNmiDepth}`}`
                  : `${use.id}.${context.domain}.depth${context.irq}.${context.nmi}`,
              ...(rootAware && context.activationRoot !== undefined
                ? { activationRoot: context.activationRoot }
                : {}),
              requestIds: Object.freeze(
                use.requestIds.map((requestId) =>
                  domainRequestId(
                    requestId,
                    context.domain,
                    input.program,
                    rootAware ? context.activationRoot : undefined,
                  ),
                ),
              ),
            }),
          ),
        );
        if (semantic.entryKind === "interrupt") {
          const rawId = bindingLabel("fn", semantic.id);
          if ((sharedProof === undefined || rawBody) && !rawHandlerBodies.has(rawId)) {
            rawHandlerBodies.set(
              rawId,
              domainMachineFunction(lowered, context, contexts, input.program, rootAware),
            );
          }
          for (const route of input.program.interruptRoutes ?? []) {
            if (bindingIdentityKey(route.handler) !== bindingIdentityKey(semantic.id)) continue;
            if (route.sink.domain !== context.domain) continue;
            const depth = context[route.sink.domain] - 1;
            if (depth < 0) continue;
            if (sharedProof !== undefined) {
              const slot = context.entrySlot;
              if (slot === undefined)
                throw loweringFailure(
                  "Selected interrupt entry has no captured word",
                  semantic.id.span,
                );
              const selection = interruptEntrySelection(route, slot, input.program);
              const retainedEntry = retained.links
                .get(slot)
                ?.entries.some(
                  (entry) =>
                    entry.id === selection.id &&
                    interruptExecutionKey(key, entry.context) ===
                      interruptExecutionKey(key, context),
                );
              if (selection.id !== context.activationRoot && !retainedEntry) continue;
              if (
                !sharedProof.bindings
                  .get(slot)
                  ?.captures.some(({ entryIdentity }) => entryIdentity === selection.id) &&
                !retainedEntry
              )
                throw loweringFailure(
                  "Selected interrupt entry has no proved capture",
                  semantic.id.span,
                );
              const entryId = c64InterruptEntryLabel(
                semantic.id,
                route.variant,
                depth,
                selection.tail,
                true,
              );
              if (
                machineFunctions.some(({ id }) => id === entryId) ||
                pendingNmiEntries.some(({ id }) => id === entryId)
              )
                continue;
              const body = domainMachineFunction(
                lowered,
                context,
                contexts,
                input.program,
                rootAware,
              );
              const linkRequestId = selection.tail ?? slot;
              if (route.sink.domain === "nmi") {
                pendingNmiEntries.push({
                  body,
                  id: entryId,
                  variant: route.variant,
                  linkRequestId,
                  handler: semantic.id,
                  contexts: executed.filter(
                    (entry) => entry.activationRoot === context.activationRoot,
                  ),
                });
              } else {
                machineFunctions.push(
                  createC64InterruptEntry(
                    body,
                    entryId,
                    route.variant,
                    route.variant.staticLinkBytes === 0 ? null : linkRequestId,
                    input.profile,
                  ),
                );
              }
              continue;
            }
            const slot =
              route.sink.domain === "irq" &&
              rootAware &&
              context.entrySlot !== undefined &&
              context.entrySlot !== `interrupt-link:irq:${depth}`
                ? context.entrySlot
                : undefined;
            if (slot === undefined && !routeDepths.get(route.installation)?.includes(depth))
              continue;
            if (slot !== undefined && !routeSlots.get(route.installation)?.has(slot)) continue;
            const entryId = c64InterruptEntryLabel(semantic.id, route.variant, depth, slot);
            if (machineFunctions.some(({ id }) => id === entryId)) continue;
            machineFunctions.push(
              createC64InterruptEntry(
                domainMachineFunction(lowered, context, contexts, input.program, rootAware),
                entryId,
                route.variant,
                route.variant.staticLinkBytes === 0
                  ? null
                  : (slot ?? `interrupt-link:${route.sink.domain}:${depth}`),
                input.profile,
              ),
            );
          }
        } else {
          const selected = domainMachineFunction(
            lowered,
            context,
            contexts,
            input.program,
            rootAware,
          );
          if (machineFunctions.some((fn) => fn.id === selected.id)) continue;
          machineFunctions.push(
            semantic.placement
              ? Object.freeze({ ...selected, placement: semantic.placement })
              : selected,
          );
        }
      }
    }

    // Captured selections outlive the question of whether an IRQ could enter.
    // Observed identities already have their real body; only absent entries
    // receive the reference shell, without adding an execution context.
    for (const binding of sharedProof?.bindings.values() ?? []) {
      for (const { entry } of binding.captures) {
        const source = functionsByKey.get(bindingIdentityKey(entry.route.handler));
        if (source === undefined)
          throw loweringFailure("Selected interrupt source is absent", null);
        const entryId = c64InterruptEntryLabel(
          source.id,
          entry.route.variant,
          entry.context[entry.route.sink.domain] - 1,
          entry.tail,
          true,
        );
        if (
          machineFunctions.some((fn) => fn.id === entryId) ||
          pendingNmiEntries.some((fn) => fn.id === entryId)
        )
          continue;
        if (
          contexts
            .get(bindingIdentityKey(source.id))
            ?.some((context) => context.activationRoot === entry.id)
        )
          throw loweringFailure("Observed interrupt entry was not emitted", source.source);
        if (
          entry.route.sink.domain !== "irq" ||
          (entry.route.variant.terminal !== "jump-saved-vector" &&
            entry.route.variant.terminal !== "jump-firmware-tail")
        )
          throw loweringFailure("Reference-only entry lacks its proved CINV ABI", source.source);
        machineFunctions.push(
          createC64ReferenceInterruptEntry(
            source,
            entryId,
            entry.route.variant,
            binding.requestId,
            input.profile,
          ),
        );
      }
    }

    const globalsByKey = new Map(
      input.program.semantic.globals.map(
        (global) => [bindingIdentityKey(global.id), global] as const,
      ),
    );
    const startupInitializers: C64StartupInitializer[] = [];
    let initializerAccumulator: number | null = 0;
    for (const initializer of input.program.semantic.initializerOrder) {
      const global = globalsByKey.get(bindingIdentityKey(initializer));
      if (global === undefined || global.entry === null) {
        throw loweringFailure("Initializer root is absent", initializer.span);
      }
      const label = bindingLabel("init", initializer);
      const executions = contexts.get(bindingIdentityKey(initializer)) ?? [];
      const blocks =
        sharedProof === undefined
          ? global.blocks
          : interruptExecutedBlocks(global, executions, sharedProof);
      if (blocks.length === 0) continue;
      if (global.runtimeInitialBytes === null) {
        const entry = input.program.interruptOwnership?.initializerEntryDepths.get(
          bindingIdentityKey(initializer),
        );
        const context =
          executions[0] ??
          Object.freeze({
            domain: "main" as const,
            irq: entry?.irq ?? 0,
            nmi: entry?.nmi ?? 0,
          });
        const discovered: StorageRequest[] = [];
        const selectedHelpers: typeof helperUses = [];
        const body = lowerFunction(
          label,
          initializer,
          blocks,
          loweringInput,
          discovered,
          generatedData,
          selectedHelpers,
          warnings,
          false,
          context,
          instructionSites,
        );
        // Startup calls execute in mainline too. Close late pointers and helper
        // scratch with the same domain facts as ordinary function lowering.
        requests.push(
          ...discovered.map((request) =>
            domainStorageRequest(request, context.domain, input.program),
          ),
        );
        helperUses.push(
          ...selectedHelpers.map((use) =>
            Object.freeze({
              ...use,
              id: `${use.id}.${context.domain}.depth${context.irq}.${context.nmi}`,
              requestIds: Object.freeze(
                use.requestIds.map((requestId) =>
                  domainRequestId(requestId, context.domain, input.program),
                ),
              ),
            }),
          ),
        );
        startupInitializers.push(Object.freeze({ kind: "call", label }));
        machineFunctions.push(domainMachineFunction(body, context, contexts, input.program));
        initializerAccumulator = null;
      } else {
        const lowered = lowerConstantInitializer(global, input, initializerAccumulator);
        startupInitializers.push(
          Object.freeze({ kind: "inline", instructions: lowered.instructions }),
        );
        initializerAccumulator = lowered.accumulator;
      }
    }

    const materializedHandlerLabels = new Set(
      machineFunctions.flatMap((fn) =>
        fn.blocks.flatMap((block) =>
          block.instructions.flatMap((instruction) =>
            instruction.operand?.kind === "label" ? [instruction.operand.label] : [],
          ),
        ),
      ),
    );
    for (const [id, body] of rawHandlerBodies) {
      // Shared proof already closes transitive raw references. Inspecting only
      // the bodies emitted before this loop would miss Q's address of raw R.
      if (sharedProof === undefined && !materializedHandlerLabels.has(id)) continue;
      machineFunctions.push(
        createC64InterruptEntry(body, id, RAW_HANDLER_ENTRY, null, input.profile),
      );
    }
    const nmiEntries = createC64NmiEntries(pendingNmiEntries, machineFunctions, input.profile);
    machineFunctions.push(...nmiEntries.functions);

    const mainFunction = functionsByKey.get(bindingIdentityKey(input.program.semantic.main));
    if (mainFunction === undefined) {
      throw loweringFailure("Main function is absent", input.program.semantic.main.span);
    }
    const mainLabel = bindingLabel("fn", mainFunction.id);
    const startup = createC64Startup({
      initializerLabels: Object.freeze([]),
      initializers: Object.freeze(startupInitializers),
      mainLabel,
      profile: input.profile,
    });
    if (startup.kind === "error") {
      throw loweringFailure(startup.reason, null);
    }

    const uniqueRequests = new Map<string, StorageRequest>();
    for (const request of requests) {
      const existing = uniqueRequests.get(request.id);
      if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(request)) {
        throw loweringFailure(
          `Storage request '${request.id}' differs between fixed code variants`,
          request.source,
        );
      }
      uniqueRequests.set(request.id, request);
    }
    requests.length = 0;
    requests.push(...uniqueRequests.values());
    requests.sort((left, right) => Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)));
    const initialInventory = inventoryStorage(input.program);
    const certifiedStorage = Object.freeze(
      [...initialInventory.requests, ...requests].sort((left, right) =>
        Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
      ),
    );
    const inventoryHash = storageInventoryHash(
      Object.freeze({
        program: input.program,
        requests: certifiedStorage,
        results: initialInventory.results,
      }),
    );
    const helperCallsById = new Map<string, HelperCallDemand>();
    for (const use of helperUses) {
      const helperIds = new Set(use.requestIds);
      const call: HelperCallDemand = Object.freeze({
        id: use.id,
        caller: use.caller,
        source: use.source,
        helperRequestIds: use.requestIds,
        liveRequestIds: Object.freeze(
          certifiedStorage
            .filter(
              (request) =>
                bindingIdentityKey(request.owner) === bindingIdentityKey(use.caller) &&
                (!rootAware || request.activationRoot === use.activationRoot) &&
                !helperIds.has(request.id),
            )
            .map((request) => request.id),
        ),
        stackBytes: 2,
      });
      const previous = helperCallsById.get(call.id);
      if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(call)) {
        throw loweringFailure("Equivalent helper contexts disagree on storage demand", use.source);
      }
      helperCallsById.set(call.id, call);
    }
    const helperCalls = [...helperCallsById.values()];
    const binder = Object.freeze({
      candidateRequestIds: Object.freeze(requests.map(({ id }) => id)),
      helperCalls: Object.freeze(helperCalls),
      nmiEntries: nmiEntries.stackDemands,
      instructionSites,
      discover: () => Object.freeze([...requests]),
    });
    return Object.freeze({
      kind: "complete",
      program: Object.freeze({
        functions: Object.freeze(machineFunctions),
        data: lowerData(
          input.program,
          generatedData,
          machineFunctions,
          startup.startup,
          input.bindingNames,
        ),
        startup: startup.startup,
        requiredStorage: Object.freeze([...requests]),
        certifiedStorage,
        storageInventoryHash: inventoryHash,
        storageProfileId: input.profile.id,
        storageProfile: input.profile.storage,
      }),
      binder,
      diagnostics: Object.freeze(warnings),
    });
  } catch (error) {
    if (isLoweringFailure(error)) {
      return Object.freeze({ kind: "error", reason: error.message, source: error.source });
    }
    throw error;
  }
}
