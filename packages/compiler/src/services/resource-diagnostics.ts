import { scalarWarning } from "../frontend/constants.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { TypedProgram } from "../frontend/service.js";
import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import type { C64LayoutResult } from "../layout/c64-layout.js";
import type { MachineProgram } from "../machine/machine-types.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import type { StorageClosureCertificate } from "../storage/storage-types.js";
import { C64_RESOURCE_BUDGETS } from "../target/c64-pal-kernal.js";
import type { TargetProfile } from "../target/profile.js";

/** Keep declaration-name and explicit-placement locations available to later resource diagnostics. */
export function resourceSourceSpans(program: TypedProgram): ReadonlyMap<string, SourceSpan> {
  const spans = new Map<string, SourceSpan>();
  for (const module of program.modules) {
    for (const unit of module.units) {
      for (const item of unit.declarations) {
        for (const declaration of item.kind === "zeropage" ? item.variables : [item]) {
          if (!("nameSpan" in declaration)) continue;
          spans.set(
            bindingIdentityKey({ sourceId: declaration.span.sourceId, span: declaration.span }),
            declaration.nameSpan,
          );
          if ("placement" in declaration && declaration.placement !== null) {
            spans.set(
              `placement:${bindingIdentityKey({ sourceId: declaration.span.sourceId, span: declaration.span })}`,
              declaration.placement.span,
            );
          }
        }
      }
    }
  }
  for (const declaration of program.declarations) {
    const asset = declaration.initializer?.embedded;
    const span = spans.get(bindingIdentityKey(declaration.binding));
    if (asset !== undefined && span !== undefined && !spans.has(`asset.${asset.assetId}`)) {
      spans.set(`asset.${asset.assetId}`, span);
      const placement = spans.get(`placement:${bindingIdentityKey(declaration.binding)}`);
      if (placement !== undefined) spans.set(`placement:asset.${asset.assetId}`, placement);
    }
  }
  return spans;
}

/** Attribute a failed final constraint to the source object rather than an internal layout ID. */
export function sourcePlacementFailure(
  machine: MachineProgram,
  spans: ReadonlyMap<string, SourceSpan>,
  objectId: string | null,
): ProjectDiagnostic {
  const object = [...machine.data, ...machine.functions].find(({ id }) => id === objectId);
  const key = objectId?.replace(/^(?:global|fn)\./u, "") ?? "";
  const name = object?.sourceName?.split(".").at(-1) ?? objectId ?? "object";
  return projectDiagnostic(
    "E10273",
    `Cannot place '${name}' — explicit placement constraints conflict with occupied storage or the selected profile window; change or remove the explicit constraint`,
    spans.get(`placement:${key}`) ?? spans.get(key) ?? null,
  );
}

/** Explain an impossible source-owned zero-page demand before SFA reserves the remaining window. */
export function sourceZeroPageOverflow(
  program: WholeProgram,
  profile: TargetProfile,
  spans: ReadonlyMap<string, SourceSpan>,
): ProjectDiagnostic | null {
  const globals = program.semantic.globals.filter(({ zeropage }) => zeropage);
  const used = globals.reduce((total, global) => total + semanticTypeSize(global.type), 0);
  const available = profile.storage.zeroPage.reduce(
    (total, range) => total + range.end - range.start + 1,
    0,
  );
  if (used <= available) return null;
  const owner = globals.at(-1)!;
  const start = Math.min(...profile.storage.zeroPage.map((range) => range.start));
  const end = Math.max(...profile.storage.zeroPage.map((range) => range.end));
  return projectDiagnostic(
    "E10032",
    `Zero-page budget exceeded — used ${used} bytes; platform '${profile.id}' allows ${available} bytes ($${start.toString(16).padStart(2, "0")}–$${end.toString(16).padStart(2, "0")})`,
    spans.get(bindingIdentityKey(owner.id)) ?? owner.source,
  );
}

/** Reject an already-impossible payload without pretending that failed layout produced final bytes. */
export function embeddedPayloadOverflow(
  machine: MachineProgram,
  profile: TargetProfile,
  spans: ReadonlyMap<string, SourceSpan>,
): ProjectDiagnostic | null {
  const assets = machine.data.filter(({ kind }) => kind === "asset");
  const bytes = assets.reduce((total, asset) => total + asset.bytes.length, 0);
  if (bytes <= C64_RESOURCE_BUDGETS.binary) return null;
  const largest = [...assets].sort((a, b) => b.bytes.length - a.bytes.length)[0]!;
  return Object.freeze({
    ...projectDiagnostic(
      "E10034",
      `Output binary (${bytes} bytes) exceeds platform '${profile.id}' maximum binary size (${C64_RESOURCE_BUDGETS.binary} bytes)`,
      spans.get(largest.id) ?? null,
    ),
    help: "This is a proved lower bound from emitted embedded data alone; code and placement padding can only increase it.",
  });
}

/** Reject an impossible shared-data demand even before code, padding and function homes are placed. */
export function residentDataOverflow(
  machine: MachineProgram,
  profile: TargetProfile,
  spans: ReadonlyMap<string, SourceSpan>,
): ProjectDiagnostic | null {
  const resident = machine.data.filter(({ zeropage }) => !zeropage);
  const used = resident.reduce((total, data) => total + data.bytes.length, 0);
  if (used <= C64_RESOURCE_BUDGETS.ram) return null;
  const largest = [...resident].sort((left, right) => right.bytes.length - left.bytes.length)[0]!;
  const key = largest.id.startsWith("global.") ? largest.id.slice("global.".length) : largest.id;
  return Object.freeze({
    ...projectDiagnostic(
      "E10238",
      `Target resource budget exceeded for 'shared RAM' — used ${used}, available ${C64_RESOURCE_BUDGETS.ram} on '${profile.id}'`,
      spans.get(key) ?? null,
    ),
    help: "This is the resident data demand alone; code, placement padding and function storage also share this budget.",
  });
}

/** Explain a final shared-memory allocation failure without presenting it as a compiler bug. */
export function sharedRamAllocationFailure(
  used: number,
  profile: TargetProfile,
  source: SourceSpan | null,
): ProjectDiagnostic {
  return Object.freeze({
    ...projectDiagnostic(
      "E10238",
      `Target resource budget exceeded for 'shared RAM' — used ${used}, available ${C64_RESOURCE_BUDGETS.ram} on '${profile.id}'`,
      source,
    ),
    help: "Demand includes emitted code and padding, platform data, and certified function storage. Remaining ranges must also satisfy contiguous size, alignment and indirect-address constraints.",
  });
}

/** Attribute a certified winning route without adding fields to its frozen evidence schema. */
function stackParts(
  program: WholeProgram,
  certificate: StorageClosureCertificate,
): {
  calls: number;
  entries: number;
  pushes: number;
} {
  const functions = new Set(program.semantic.functions.map(({ id }) => bindingIdentityKey(id)));
  let calls = 0;
  let entries = 0;
  let caller = false;
  for (const step of certificate.hardwareStackRoute) {
    if (step.startsWith("interrupt:")) {
      const variant = program.interruptRoutes?.find(
        (route) => `interrupt:${route.variant.id}` === step,
      )?.variant;
      entries += variant?.handlerEntryStackBytes ?? 0;
      caller = false;
    } else if (step.startsWith("initializer:")) {
      calls += 2;
      caller = true;
    } else if (functions.has(step)) {
      if (caller) calls += 2;
      caller = true;
    } else if (step.startsWith("helper:")) {
      // Selected direct helpers retain one JSR return address. Their explicit
      // pushes, like source PHP and vector-update saves, remain in the residual.
      calls += 2;
    }
  }
  return { calls, entries, pushes: certificate.hardwareStackPeak - calls - entries };
}

/** Report warnings from closed function storage; no warning changes generated instructions. */
export function storageResourceWarnings(
  program: WholeProgram,
  profile: TargetProfile,
  certificate: StorageClosureCertificate,
  spans: ReadonlyMap<string, SourceSpan>,
): readonly ProjectDiagnostic[] {
  const diagnostics: ProjectDiagnostic[] = [];
  const main = spans.get(bindingIdentityKey(program.semantic.main)) ?? program.semantic.main.span;
  const globals = program.semantic.globals.filter(({ zeropage }) => zeropage);
  const used =
    certificate.staticBytes.zeroPage +
    globals.reduce((total, global) => total + semanticTypeSize(global.type), 0);
  const available = C64_RESOURCE_BUDGETS.zeroPage;
  if (used * 100 >= available * C64_RESOURCE_BUDGETS.warningPercent) {
    const owner = globals.at(-1);
    diagnostics.push(
      scalarWarning(
        "W10030",
        `Zero-page usage is ${used}/${available} bytes (${Number(((100 * used) / available).toFixed(2))}%) on '${profile.id}'`,
        owner === undefined ? main : (spans.get(bindingIdentityKey(owner.id)) ?? owner.source),
      ),
    );
  }
  if (certificate.hardwareStackPeak >= C64_RESOURCE_BUDGETS.stackWarning) {
    const parts = stackParts(program, certificate);
    const capacity = profile.storage.hardwareStackCapacity! - profile.storage.hardwareStackReserve!;
    diagnostics.push(
      scalarWarning(
        "W10180",
        `Maximum simultaneous hardware-stack use is ${certificate.hardwareStackPeak} bytes on '${profile.id}'; usable capacity is ${capacity} (calls ${parts.calls}, interrupt entries ${parts.entries}, explicit pushes ${parts.pushes})`,
        main,
      ),
    );
  }
  return diagnostics;
}

/** Use actual final intervals for resident-RAM and emitted-asset advisories. */
export function layoutResourceWarnings(
  layout: Extract<C64LayoutResult, { kind: "complete" }>,
  program: WholeProgram,
  profile: TargetProfile,
  spans: ReadonlyMap<string, SourceSpan>,
): readonly ProjectDiagnostic[] {
  const main = spans.get(bindingIdentityKey(program.semantic.main)) ?? program.semantic.main.span;
  const diagnostics: ProjectDiagnostic[] = [];
  const resident = layout.intervals.filter(({ start }) => start >= profile.packager.residentStart);
  const ram = resident.reduce((total, interval) => total + interval.end - interval.start + 1, 0);
  const largestGlobal = [...program.semantic.globals].sort(
    (a, b) => semanticTypeSize(b.type) - semanticTypeSize(a.type),
  )[0];
  if (ram * 100 >= C64_RESOURCE_BUDGETS.ram * C64_RESOURCE_BUDGETS.warningPercent) {
    diagnostics.push(
      scalarWarning(
        "W10033",
        `RAM usage is ${Number(((100 * ram) / C64_RESOURCE_BUDGETS.ram).toFixed(2))}% of platform '${profile.id}' budget`,
        largestGlobal === undefined
          ? main
          : (spans.get(bindingIdentityKey(largestGlobal.id)) ?? largestGlobal.source),
      ),
    );
  }
  const assets = resident.filter(({ kind }) => kind === "asset");
  const embedded = assets.reduce((total, interval) => total + interval.end - interval.start + 1, 0);
  if (embedded * 100 >= C64_RESOURCE_BUDGETS.binary * C64_RESOURCE_BUDGETS.warningPercent) {
    diagnostics.push(
      scalarWarning(
        "W10150",
        `Embedded data uses ${embedded} bytes (${Number(((100 * embedded) / C64_RESOURCE_BUDGETS.binary).toFixed(2))}% of '${profile.id}' binary-size budget)`,
        spans.get(assets[0]!.id) ?? main,
      ),
    );
  }
  return diagnostics;
}
