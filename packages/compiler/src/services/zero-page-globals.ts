import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { typeBytes } from "../machine/lower.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import type { StorageProfile, StorageRange } from "../storage/storage-types.js";

/**
 * Place source-owned zero-page bytes before function scratch can claim the same addresses.
 * Fixed addresses take priority; remaining declarations take the first available source window.
 * The reduced profile is used only by SFA, while final layout still sees the full C64 window.
 */
export function reserveZeroPageGlobals(
  program: WholeProgram,
  profile: StorageProfile,
): { readonly program: WholeProgram; readonly storage: StorageProfile } | null {
  const globals = program.semantic.globals.filter(({ zeropage }) => zeropage);
  const fixed = globals.filter(({ placement }) => placement?.at != null);
  const automatic = globals.filter(({ placement }) => placement?.at == null);
  const occupied: StorageRange[] = [];
  const addresses = new Map<string, number>();
  for (const global of [...fixed, ...automatic]) {
    const bytes = typeBytes(global.type);
    const placement = global.placement;
    const valid = (start: number): boolean => {
      const end = start + bytes - 1;
      return (
        bytes > 0 &&
        start % (placement?.align ?? 1) === 0 &&
        (placement?.noCross == null ||
          Math.floor(start / placement.noCross) === Math.floor(end / placement.noCross)) &&
        profile.zeroPage.some((range) => start >= range.start && end <= range.end) &&
        !occupied.some((range) => start <= range.end && range.start <= end)
      );
    };
    const start =
      placement?.at != null
        ? placement.at
        : profile.zeroPage
            .flatMap((range) =>
              Array.from(
                { length: range.end - range.start + 1 },
                (_, index) => range.start + index,
              ),
            )
            .find(valid);
    if (start === undefined || !valid(start)) return null;
    occupied.push(Object.freeze({ start, end: start + bytes - 1 }));
    addresses.set(bindingIdentityKey(global.id), start);
  }
  const allocatedGlobals = program.semantic.globals.map((global) => {
    if (!global.zeropage) return global;
    const at = addresses.get(bindingIdentityKey(global.id))!;
    return Object.freeze({
      ...global,
      placement: Object.freeze({
        at,
        align: global.placement?.align ?? 1,
        noCross: global.placement?.noCross ?? null,
        region: null,
      }),
    });
  });
  const zeroPage = profile.zeroPage.flatMap((range) => {
    const available: StorageRange[] = [];
    let start = range.start;
    for (const used of [...occupied].sort((left, right) => left.start - right.start)) {
      if (used.end < range.start || used.start > range.end) continue;
      if (start < used.start) available.push(Object.freeze({ start, end: used.start - 1 }));
      start = Math.max(start, used.end + 1);
    }
    if (start <= range.end) available.push(Object.freeze({ start, end: range.end }));
    return available;
  });
  return Object.freeze({
    program: Object.freeze({
      ...program,
      semantic: Object.freeze({ ...program.semantic, globals: Object.freeze(allocatedGlobals) }),
    }),
    storage: Object.freeze({ ...profile, zeroPage: Object.freeze(zeroPage) }),
  });
}
