/**
 * The intrinsic registry — RD-17 §4.2 (AR-29, AR-P3, AR-P9).
 *
 * A per-compile lookup table populated with the core catalog (T1/T2 + internal T3
 * routines) and, optionally, a platform plugin's T4 descriptor array (R11). The
 * frontend consumes it via `AnalyzeInput.registry` and codegen via parameter
 * injection — there is no global singleton (AR-P3).
 */

import type { PlatformProfile } from "../platform/platform-profile.js";
import type { IntrinsicDescriptor } from "./descriptor.js";
import { CORE_INTRINSICS, RT_ROUTINES } from "./catalog.js";

/**
 * The registry contract the compiler consults uniformly (never special-casing an
 * individual intrinsic name — AC-17).
 */
export interface IntrinsicRegistry {
  /**
   * Register a descriptor. Throws a plain `Error` on a duplicate name — a
   * compiler-setup bug, not a user diagnostic (AR-P9).
   *
   * @param descriptor The descriptor to add.
   */
  register(descriptor: IntrinsicDescriptor): void;

  /**
   * Look a descriptor up by name.
   *
   * @param name The intrinsic name (user-visible or internal `__rt_*`).
   * @returns The descriptor, or `undefined` if none is registered.
   */
  get(name: string): IntrinsicDescriptor | undefined;

  /**
   * Whether `name` is a reserved user-visible intrinsic name (R20). Internal
   * `__rt_*` routine symbols are registered but are NOT language identifiers, so
   * they never report reserved (RD-17 §4.3 internal table).
   *
   * @param name The candidate declaration name.
   * @returns `true` if a user-visible intrinsic already claims the name.
   */
  isReserved(name: string): boolean;

  /**
   * Every descriptor whose availability predicate passes for `profile` (R8).
   *
   * @param profile The active platform profile.
   * @returns The available descriptors.
   */
  getAvailable(profile: PlatformProfile): IntrinsicDescriptor[];

  /**
   * Every registered descriptor across all platforms.
   *
   * @returns All descriptors.
   */
  getAll(): IntrinsicDescriptor[];
}

/**
 * Internal names beginning with this prefix are compiler-internal symbols (e.g.
 * `__rt_mul8`, `__frame_*`, `__zp_arg_*`), never user-writable language
 * identifiers — so they are registered but excluded from the reserved-name gate.
 */
const INTERNAL_PREFIX = "__";

/**
 * The concrete registry. A `Map` for O(1) name lookup plus a `Set` of the
 * user-visible (reserved) names.
 */
class IntrinsicRegistryImpl implements IntrinsicRegistry {
  private readonly byName = new Map<string, IntrinsicDescriptor>();
  private readonly reservedNames = new Set<string>();

  public register(descriptor: IntrinsicDescriptor): void {
    if (this.byName.has(descriptor.name)) {
      throw new Error(`intrinsic '${descriptor.name}' is already registered`);
    }
    this.byName.set(descriptor.name, descriptor);
    if (!descriptor.name.startsWith(INTERNAL_PREFIX)) {
      this.reservedNames.add(descriptor.name);
    }
  }

  public get(name: string): IntrinsicDescriptor | undefined {
    return this.byName.get(name);
  }

  public isReserved(name: string): boolean {
    return this.reservedNames.has(name);
  }

  public getAvailable(profile: PlatformProfile): IntrinsicDescriptor[] {
    return [...this.byName.values()].filter((d) => d.availability(profile));
  }

  public getAll(): IntrinsicDescriptor[] {
    return [...this.byName.values()];
  }
}

/**
 * Create a registry pre-populated with the core catalog and, optionally, a
 * platform's T4 descriptors (R11, AR-P3). The core catalog is registered first
 * (user-visible T1/T2 then internal T3 routines), then any platform descriptors
 * — so the registry is fully populated before `analyze()` runs (AC-15/AC-16).
 *
 * When `platformId` is given, each platform descriptor is merged with a wrapped
 * availability predicate keyed on the contributing platform (R25/PF-015):
 * `profile → profile.platformId === platformId && original(profile)` — and the
 * id is stamped on the descriptor for diagnostic rendering (AR-P11/AR-P14).
 *
 * @param platformDescriptors Optional T4 descriptors contributed by the active
 *   platform plugin; merged into the registry at compile start (AC-15/AC-16).
 * @param platformId The contributing plugin's id — enables the platform-keyed
 *   availability wrapper. Omitted → descriptors register unwrapped (test use).
 * @returns A fresh registry.
 */
export function createIntrinsicRegistry(
  platformDescriptors?: readonly IntrinsicDescriptor[],
  platformId?: string,
): IntrinsicRegistry {
  const registry = new IntrinsicRegistryImpl();
  for (const descriptor of CORE_INTRINSICS) {
    registry.register(descriptor);
  }
  for (const descriptor of RT_ROUTINES) {
    registry.register(descriptor);
  }
  if (platformDescriptors) {
    for (const descriptor of platformDescriptors) {
      registry.register(
        platformId === undefined ? descriptor : wrapForPlatform(descriptor, platformId),
      );
    }
  }
  return registry;
}

/**
 * Wrap a T4 descriptor for its contributing platform (R25/PF-015): availability
 * additionally requires the target profile's `platformId` to match, and the id
 * is stamped for diagnostic rendering. Pure — the original descriptor is
 * untouched.
 *
 * @param descriptor The plugin-authored descriptor.
 * @param platformId The contributing plugin's id.
 * @returns The merged descriptor registered into the registry.
 */
function wrapForPlatform(
  descriptor: IntrinsicDescriptor,
  platformId: string,
): IntrinsicDescriptor {
  return {
    ...descriptor,
    platformId,
    availability: (profile: PlatformProfile) =>
      profile.platformId === platformId && descriptor.availability(profile),
  };
}
