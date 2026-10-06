import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { InterruptRoute } from "../semantic/whole-program.js";
import type { StorageInventory } from "./storage-types.js";

/**
 * Find an installed NMI route whose selected execution needs a private RAM/ZP home.
 * Check the final inventory so machine-selected helper scratch cannot escape the proof.
 * Only an exact, separately proved installation word is exempt; retained raw code is
 * not an invocation witness, and persistent storage alone is not safe under re-entry.
 * @param inventory Complete semantic and machine-selected function-storage demands.
 * @returns Responsible installation, or null when every selected NMI has no private homes.
 */
export function nmiPrivateStorageRoute(inventory: StorageInventory): InterruptRoute | null {
  const route = inventory.program.interruptRoutes?.find(({ sink }) => sink.domain === "nmi");
  if (route === undefined) return null;
  const proof = inventory.program.interruptContextAnalysis;
  if (proof === undefined || proof.diagnostics.length > 0) return route;
  for (const request of inventory.requests) {
    // A zero-length array retains a position marker, not invocation-private bytes.
    if (request.bytes === 0) continue;
    if (
      request.domain !== "nmi" ||
      !proof.contexts
        .get(bindingIdentityKey(request.owner))
        ?.some(
          (context) =>
            context.domain === "nmi" && context.activationRoot === request.activationRoot,
        )
    )
      continue;
    const binding = proof.bindings.get(request.id);
    if (
      binding !== undefined &&
      request.storageClass === "pointer" &&
      request.binding === null &&
      request.type === null &&
      request.value === binding.requestId &&
      request.bytes === 2 &&
      request.pageSafeIndirect === true &&
      request.persistent === true &&
      binding.captures.some(
        ({ installer }) =>
          installer.domain === request.domain &&
          installer.activationRoot === request.activationRoot,
      )
    )
      continue;
    for (const word of proof.bindings.values()) {
      const capture = word.captures.find(
        ({ entry }) => entry.id === request.activationRoot && entry.route.sink.domain === "nmi",
      );
      if (capture !== undefined) return capture.entry.route;
    }
    return route;
  }
  return null;
}
