import type {
  ExecutableBinding,
  HandlerImplementation,
  PublishedSnapshot,
} from "./binding-model.js";

type PublishedBindingLookup = (
  snapshot: PublishedSnapshot,
  handlerId: string,
) => ExecutableBinding<HandlerImplementation> | undefined;

let installedLookup: PublishedBindingLookup = () => undefined;
let installed = false;

/** Installs the resolver-owned opaque snapshot lookup exactly once. */
export function installPublishedBindingLookup(lookup: PublishedBindingLookup): void {
  if (installed) throw new Error("Published binding lookup is already installed.");
  installedLookup = lookup;
  installed = true;
}

/** Delegates a compatibility lookup to the resolver-owned opaque snapshot state. */
export function lookupPublishedBinding(
  snapshot: PublishedSnapshot,
  handlerId: string,
): ExecutableBinding<HandlerImplementation> | undefined {
  return installedLookup(snapshot, handlerId);
}
