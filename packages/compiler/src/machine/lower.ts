import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import {
  interruptExecutionContexts,
  interruptRouteDepths,
} from "../semantic/interrupt-contexts.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import type { HelperCallDemand, StorageRequest } from "../storage/storage-types.js";
import { storageInventoryHash } from "../storage/closure.js";
import { inventoryStorage } from "../storage/inventory.js";
import {
  createC64Startup,
  createC64StartupStateData,
  type C64StartupInitializer,
} from "../layout/startup.js";
import { machineInstruction } from "./lower-control.js";
import { c64InterruptEntryLabel, createC64InterruptEntry, RAW_HANDLER_ENTRY } from "./lower-c64.js";
import {
  domainMachineFunction,
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
  }[] = [];
  const warnings: ProjectDiagnostic[] = [];
  try {
    const loweringInput = Object.freeze({
      ...input,
      placement: provisionalDomainAliases(input.placement, input.program),
    });
    const functionsByKey = new Map(
      input.program.semantic.functions.map((fn) => [bindingIdentityKey(fn.id), fn] as const),
    );
    const contexts = interruptExecutionContexts(input.program);
    const routeDepths = interruptRouteDepths(input.program, contexts);
    const machineFunctions: MachineFunction[] = [];
    const rawHandlerBodies = new Map<string, MachineFunction>();
    for (const functionId of input.program.reachableFunctions) {
      const semantic = functionsByKey.get(bindingIdentityKey(functionId));
      if (semantic === undefined) {
        throw loweringFailure("Reachable semantic function is absent", functionId.span);
      }
      const id = bindingLabel("fn", semantic.id);
      const variants = contexts.get(bindingIdentityKey(semantic.id)) ?? [
        Object.freeze({ domain: "main" as const, irq: 0, nmi: 0 }),
      ];
      for (const context of variants) {
        const discovered: StorageRequest[] = [];
        const selectedHelpers: typeof helperUses = [];
        const lowered = lowerFunction(
          id,
          semantic.id,
          semantic.blocks,
          loweringInput,
          discovered,
          generatedData,
          selectedHelpers,
          warnings,
          bindingIdentityKey(semantic.id) === bindingIdentityKey(input.program.semantic.main),
          context,
        );
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
        if (semantic.entryKind === "interrupt") {
          const rawId = bindingLabel("fn", semantic.id);
          if (!rawHandlerBodies.has(rawId)) {
            rawHandlerBodies.set(
              rawId,
              domainMachineFunction(lowered, context, contexts, input.program),
            );
          }
          for (const route of input.program.interruptRoutes ?? []) {
            if (bindingIdentityKey(route.handler) !== bindingIdentityKey(semantic.id)) continue;
            if (route.sink.domain !== context.domain) continue;
            const depth = context[route.sink.domain] - 1;
            if (depth < 0 || !routeDepths.get(route.installation)?.includes(depth)) continue;
            const entryId = c64InterruptEntryLabel(semantic.id, route.variant, depth);
            if (machineFunctions.some(({ id }) => id === entryId)) continue;
            machineFunctions.push(
              createC64InterruptEntry(
                domainMachineFunction(lowered, context, contexts, input.program),
                entryId,
                route.variant,
                route.variant.staticLinkBytes === 0
                  ? null
                  : `interrupt-link:${route.sink.domain}:${depth}`,
                input.profile,
              ),
            );
          }
        } else {
          const selected = domainMachineFunction(lowered, context, contexts, input.program);
          machineFunctions.push(
            semantic.placement
              ? Object.freeze({ ...selected, placement: semantic.placement })
              : selected,
          );
        }
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
      if (global.runtimeInitialBytes === null) {
        const entry = input.program.interruptOwnership?.initializerEntryDepths.get(
          bindingIdentityKey(initializer),
        );
        const context = Object.freeze({
          domain: "main" as const,
          irq: entry?.irq ?? 0,
          nmi: entry?.nmi ?? 0,
        });
        startupInitializers.push(Object.freeze({ kind: "call", label }));
        machineFunctions.push(
          domainMachineFunction(
            lowerFunction(
              label,
              initializer,
              global.blocks,
              loweringInput,
              requests,
              generatedData,
              helperUses,
              warnings,
              false,
              context,
            ),
            context,
            contexts,
            input.program,
          ),
        );
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
      if (!materializedHandlerLabels.has(id)) continue;
      machineFunctions.push(
        createC64InterruptEntry(body, id, RAW_HANDLER_ENTRY, null, input.profile),
      );
    }

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
    const helperCalls: HelperCallDemand[] = helperUses.map((use) => {
      const helperIds = new Set(use.requestIds);
      return Object.freeze({
        id: use.id,
        caller: use.caller,
        source: use.source,
        helperRequestIds: use.requestIds,
        liveRequestIds: Object.freeze(
          certifiedStorage
            .filter(
              (request) =>
                bindingIdentityKey(request.owner) === bindingIdentityKey(use.caller) &&
                !helperIds.has(request.id),
            )
            .map((request) => request.id),
        ),
        stackBytes: 2,
      });
    });
    const binder = Object.freeze({
      candidateRequestIds: Object.freeze(requests.map(({ id }) => id)),
      helperCalls: Object.freeze(helperCalls),
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
